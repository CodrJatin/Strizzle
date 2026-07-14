import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { tasks, taskMaterialRefs, hiveMembers, users, hives, notifications, materials } from '@/db/schema';
import { eq, and, or, inArray, desc, asc, sql, isNull, isNotNull, ne } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/logActivity';
import { sendPushNotification } from '../lib/sendPushNotification';

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).default('todo'),
  dueAt: z.string().datetime().optional().nullable(),
  hiveId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  source: z.enum(['personal', 'hive_deadline', 'shelf_converted']).default('personal'),
  sourceRefId: z.string().uuid().optional().nullable(),
  materialIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  materialIds: z.array(z.string().uuid()).optional(),
});

export const deleteTaskSchema = z.object({
  id: z.string().uuid(),
});

export const getTasksSchema = z.object({
  hiveId: z.string().uuid(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const addToCalendarSchema = z.object({
  sourceRefId: z.string().uuid(),
  dueAt: z.string().datetime(),
  title: z.string().min(1),
  hiveId: z.string().uuid(),
});

export const taskRouter = createTRPCRouter({
  getTask: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const [task] = await ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            status: tasks.status,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            assigneeId: tasks.assigneeId,
            creatorId: tasks.creatorId,
            hiveId: tasks.hiveId,
            createdAt: tasks.createdAt,
            assigneeName: users.fullName,
            assigneeAvatar: users.avatarUrl,
          })
          .from(tasks)
          .leftJoin(users, eq(tasks.assigneeId, users.id))
          .where(eq(tasks.id, input.id))
          .limit(1);

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found.',
          });
        }

        if (task.hiveId) {
          await enforceRole(ctx, 'viewer', task.hiveId);
        } else {
          if (task.creatorId !== ctx.user.id && task.assigneeId !== ctx.user.id) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You do not have access to this personal task.',
            });
          }
        }

        const refs = await ctx.db
          .select({
            id: materials.id,
            title: materials.title,
            contentType: materials.contentType,
          })
          .from(taskMaterialRefs)
          .innerJoin(materials, eq(taskMaterialRefs.materialId, materials.id))
          .where(eq(taskMaterialRefs.taskId, task.id));

        return {
          ...task,
          materials: refs.map((r) => ({
            id: r.id,
            title: r.title || "Untitled",
            contentType: r.contentType,
          })),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in getTask:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve task details.',
        });
      }
    }),

  createTask: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.hiveId) {
          // Hive task: check role
          await enforceRole(ctx, 'member', input.hiveId);
        }

        return await ctx.db.transaction(async (tx) => {
          // Insert the task
          const [task] = await tx
            .insert(tasks)
            .values({
              creatorId: ctx.user.id,
              assigneeId: input.assigneeId || (input.hiveId ? null : ctx.user.id),
              hiveId: input.hiveId || null,
              title: input.title,
              description: input.description ?? null,
              status: input.status,
              priority: input.priority,
              dueAt: input.dueAt ? new Date(input.dueAt) : null,
              source: input.source,
              sourceRefId: input.sourceRefId || null,
            })
            .returning();

          if (!task) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to create task.',
            });
          }

          // If material links are provided
          if (input.materialIds && input.materialIds.length > 0) {
            await tx
              .insert(taskMaterialRefs)
              .values(
                input.materialIds.map((mId) => ({
                  taskId: task.id,
                  materialId: mId,
                }))
              );
          } else if (input.sourceRefId && input.source === 'shelf_converted') {
            // Deprecated fallback from Phase 2
            await tx
              .insert(taskMaterialRefs)
              .values({
                taskId: task.id,
                materialId: input.sourceRefId,
              });
          }

          // Logging & notifications
          if (input.hiveId) {
            await logActivity(tx, {
              hiveId: input.hiveId,
              actorId: ctx.user.id,
              actionType: 'task_created',
              entityType: 'task',
              entityId: task.id,
            });

            // Notify assignee if assigned to someone else
            if (input.assigneeId && input.assigneeId !== ctx.user.id) {
              await tx
                .insert(notifications)
                .values({
                  userId: input.assigneeId,
                  hiveId: input.hiveId,
                  type: 'task_assigned',
                  entityId: task.id,
                });

              // Trigger background push notification
              const [actor] = await tx
                .select({ fullName: users.fullName })
                .from(users)
                .where(eq(users.id, ctx.user.id))
                .limit(1);
              const actorName = actor?.fullName || "A classmate";

              sendPushNotification(input.assigneeId, {
                title: "New Task Assigned",
                body: `${actorName} assigned you a task: ${task.title}`,
                url: `/desk`,
                hiveId: input.hiveId || undefined,
              });
            }
          }

          return task;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in createTask:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the task.',
        });
      }
    }),

  updateTask: protectedProcedure
    .input(updateTaskSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [existingTask] = await ctx.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, input.id))
          .limit(1);

        if (!existingTask) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found.',
          });
        }

        // Access check
        if (existingTask.hiveId) {
          await enforceRole(ctx, 'member', existingTask.hiveId);
        } else {
          if (existingTask.creatorId !== ctx.user.id && existingTask.assigneeId !== ctx.user.id) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You do not have access to this personal task.',
            });
          }
        }

        return await ctx.db.transaction(async (tx) => {
          // Prepare fields
          const updates: Partial<typeof tasks.$inferInsert> = {
            updatedAt: new Date(),
          };

          if (input.title !== undefined) updates.title = input.title;
          if (input.description !== undefined) updates.description = input.description;
          if (input.priority !== undefined) updates.priority = input.priority;
          if (input.status !== undefined) updates.status = input.status;
          if (input.dueAt !== undefined) updates.dueAt = input.dueAt ? new Date(input.dueAt) : null;
          if (input.assigneeId !== undefined) updates.assigneeId = input.assigneeId;

          const [updatedTask] = await tx
            .update(tasks)
            .set(updates)
            .where(eq(tasks.id, input.id))
            .returning();

          if (!updatedTask) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to update task.',
            });
          }

          // Sync materials if provided
          if (input.materialIds !== undefined) {
            await tx
              .delete(taskMaterialRefs)
              .where(eq(taskMaterialRefs.taskId, input.id));

            if (input.materialIds.length > 0) {
              await tx
                .insert(taskMaterialRefs)
                .values(
                  input.materialIds.map((mId) => ({
                    taskId: input.id,
                    materialId: mId,
                  }))
                );
            }
          }

          // Notify assignee if changed and not the current user
          if (
            existingTask.hiveId &&
            input.assigneeId !== undefined &&
            input.assigneeId !== existingTask.assigneeId &&
            input.assigneeId !== null &&
            input.assigneeId !== ctx.user.id
          ) {
            await tx
              .insert(notifications)
              .values({
                userId: input.assigneeId,
                hiveId: existingTask.hiveId,
                type: 'task_assigned',
                entityId: input.id,
              });

            // Trigger background push notification
            const [actor] = await tx
              .select({ fullName: users.fullName })
              .from(users)
              .where(eq(users.id, ctx.user.id))
              .limit(1);
            const actorName = actor?.fullName || "A classmate";

            sendPushNotification(input.assigneeId, {
              title: "New Task Assigned",
              body: `${actorName} assigned you a task: ${updatedTask.title}`,
              url: `/desk`,
              hiveId: existingTask.hiveId,
            });
          }

          // Log status completion
          if (
            existingTask.hiveId &&
            input.status === 'done' &&
            existingTask.status !== 'done'
          ) {
            await logActivity(tx, {
              hiveId: existingTask.hiveId,
              actorId: ctx.user.id,
              actionType: 'task_completed',
              entityType: 'task',
              entityId: input.id,
            });
          }

          return updatedTask;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in updateTask:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while updating the task.',
        });
      }
    }),

  deleteTask: protectedProcedure
    .input(deleteTaskSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [task] = await ctx.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, input.id))
          .limit(1);

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Task not found.',
          });
        }

        if (task.hiveId) {
          const member = await enforceRole(ctx, 'member', task.hiveId);
          const isCreator = task.creatorId === ctx.user.id;
          const isAdminOrOwner = member.role === 'admin' || member.role === 'owner';
          if (!isCreator && !isAdminOrOwner) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Only the task creator or a hive administrator can delete this task.',
            });
          }
        } else {
          if (task.creatorId !== ctx.user.id) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You can only delete tasks you created.',
            });
          }
        }

        await ctx.db
          .delete(tasks)
          .where(eq(tasks.id, input.id));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in deleteTask:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete the task.',
        });
      }
    }),

  getTasks: protectedProcedure
    .input(getTasksSchema)
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'viewer', input.hiveId);

        const conditions = [eq(tasks.hiveId, input.hiveId)];
        if (input.status) conditions.push(eq(tasks.status, input.status));
        if (input.priority) conditions.push(eq(tasks.priority, input.priority));
        if (input.assigneeId) conditions.push(eq(tasks.assigneeId, input.assigneeId));

        const results = await ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            status: tasks.status,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            assigneeId: tasks.assigneeId,
            creatorId: tasks.creatorId,
            createdAt: tasks.createdAt,
            assigneeName: users.fullName,
            assigneeAvatar: users.avatarUrl,
          })
          .from(tasks)
          .leftJoin(users, eq(tasks.assigneeId, users.id))
          .where(and(...conditions))
          .orderBy(sql`${tasks.dueAt} ASC NULLS LAST`, desc(tasks.createdAt));

        if (results.length === 0) return [];

        const taskIds = results.map((t) => t.id);
        const refs = await ctx.db
          .select({
            taskId: taskMaterialRefs.taskId,
            materialId: taskMaterialRefs.materialId,
            title: materials.title,
            contentType: materials.contentType,
          })
          .from(taskMaterialRefs)
          .innerJoin(materials, eq(taskMaterialRefs.materialId, materials.id))
          .where(inArray(taskMaterialRefs.taskId, taskIds));

        const refsMap = refs.reduce((acc, ref) => {
          if (!acc[ref.taskId]) acc[ref.taskId] = [];
          acc[ref.taskId].push({
            id: ref.materialId,
            title: ref.title || "Untitled",
            contentType: ref.contentType,
          });
          return acc;
        }, {} as Record<string, Array<{ id: string; title: string; contentType: string }>>);

        return results.map((task) => ({
          ...task,
          materials: refsMap[task.id] || [],
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in getTasks:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve tasks.',
        });
      }
    }),

  getMyTasks: protectedProcedure
    .input(z.object({
      includeCompleted: z.boolean().optional().default(false)
    }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const includeCompleted = input?.includeCompleted ?? false;
        
        const conditions = [
          or(
            eq(tasks.assigneeId, ctx.user.id),
            and(eq(tasks.creatorId, ctx.user.id), isNull(tasks.hiveId))
          )
        ];

        if (!includeCompleted) {
          conditions.push(ne(tasks.status, 'done'));
        }

        const results = await ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            status: tasks.status,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            hiveId: tasks.hiveId,
            hiveName: hives.name,
            courseCode: hives.courseCode,
            colorTheme: hives.colorTheme,
          })
          .from(tasks)
          .leftJoin(hives, eq(tasks.hiveId, hives.id))
          .where(and(...conditions))
          .orderBy(sql`${tasks.dueAt} ASC NULLS LAST`);

        if (results.length === 0) return [];

        const taskIds = results.map((t) => t.id);
        const refs = await ctx.db
          .select({
            taskId: taskMaterialRefs.taskId,
            materialId: taskMaterialRefs.materialId,
            title: materials.title,
            contentType: materials.contentType,
          })
          .from(taskMaterialRefs)
          .innerJoin(materials, eq(taskMaterialRefs.materialId, materials.id))
          .where(inArray(taskMaterialRefs.taskId, taskIds));

        const refsMap = refs.reduce((acc, ref) => {
          if (!acc[ref.taskId]) acc[ref.taskId] = [];
          acc[ref.taskId].push({
            id: ref.materialId,
            title: ref.title || "Untitled",
            contentType: ref.contentType,
          });
          return acc;
        }, {} as Record<string, Array<{ id: string; title: string; contentType: string }>>);

        return results.map((task) => ({
          ...task,
          materials: refsMap[task.id] || [],
        }));
      } catch (error) {
        console.error("Error in getMyTasks:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve personal tasks.',
        });
      }
    }),

  getUpcomingDeadlines: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const userHives = await ctx.db
          .select({ hiveId: hiveMembers.hiveId })
          .from(hiveMembers)
          .where(eq(hiveMembers.userId, ctx.user.id));
        const hiveIds = userHives.map((h) => h.hiveId);

        const conditions = [
          isNotNull(tasks.dueAt),
          ne(tasks.status, 'done'),
        ];

        const accessConditions = [
          eq(tasks.creatorId, ctx.user.id),
          eq(tasks.assigneeId, ctx.user.id),
        ];

        if (hiveIds.length > 0) {
          accessConditions.push(inArray(tasks.hiveId, hiveIds));
        }

        const accessOr = or(...accessConditions);
        if (accessOr) {
          conditions.push(accessOr);
        }

        return await ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            dueAt: tasks.dueAt,
            priority: tasks.priority,
            hiveId: tasks.hiveId,
            hiveName: hives.name,
            courseCode: hives.courseCode,
          })
          .from(tasks)
          .leftJoin(hives, eq(tasks.hiveId, hives.id))
          .where(and(...conditions))
          .orderBy(asc(tasks.dueAt))
          .limit(5);
      } catch (error) {
        console.error("Error in getUpcomingDeadlines:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve upcoming deadlines.',
        });
      }
    }),

  addToCalendar: protectedProcedure
    .input(addToCalendarSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [existing] = await ctx.db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.source, 'hive_deadline'),
              eq(tasks.sourceRefId, input.sourceRefId),
              eq(tasks.creatorId, ctx.user.id)
            )
          )
          .limit(1);

        if (existing) {
          return { alreadyAdded: true, task: existing };
        }

        const [task] = await ctx.db
          .insert(tasks)
          .values({
            creatorId: ctx.user.id,
            assigneeId: ctx.user.id,
            hiveId: input.hiveId,
            title: input.title,
            dueAt: new Date(input.dueAt),
            source: 'hive_deadline',
            sourceRefId: input.sourceRefId,
            status: 'todo',
            priority: 'medium',
          })
          .returning();

        return { alreadyAdded: false, task };
      } catch (error) {
        console.error("Error in addToCalendar:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add item to calendar.',
        });
      }
    }),
});
