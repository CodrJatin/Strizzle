import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { hives, hiveMembers, announcements, tasks, activityLog, hiveMaterialShares, users } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const createHiveInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  courseCode: z.string().optional(),
  colorTheme: z.string().default('blue'),
});

export const updateHiveInputSchema = z.object({
  hiveId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  courseCode: z.string().optional().nullable(),
  colorTheme: z.string().optional(),
  feedSettings: z.record(z.string(), z.boolean()).optional(),
});

export const hiveRouter = createTRPCRouter({
  createHive: protectedProcedure
    .input(createHiveInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          const [hive] = await tx
            .insert(hives)
            .values({
              ownerId: ctx.user.id,
              name: input.name,
              description: input.description ?? null,
              courseCode: input.courseCode ?? null,
              colorTheme: input.colorTheme,
            })
            .returning();

          if (!hive) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to create hive.',
            });
          }

          await tx
            .insert(hiveMembers)
            .values({
              hiveId: hive.id,
              userId: ctx.user.id,
              role: 'owner',
            });

          return hive;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in createHive:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create hive.',
        });
      }
    }),

  getHive: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const member = await enforceRole(ctx, 'viewer', input.hiveId);

        const [hive] = await ctx.db
          .select()
          .from(hives)
          .where(eq(hives.id, input.hiveId))
          .limit(1);

        if (!hive) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Hive not found.',
          });
        }

        return {
          ...hive,
          role: member.role,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getHive:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve hive.',
        });
      }
    }),

  getUserHives: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const list = await ctx.db
          .select({
            id: hives.id,
            name: hives.name,
            description: hives.description,
            courseCode: hives.courseCode,
            colorTheme: hives.colorTheme,
            createdAt: hives.createdAt,
            role: hiveMembers.role,
            memberCount: sql<number>`(
              SELECT count(*)::int 
              FROM ${hiveMembers} 
              WHERE ${hiveMembers.hiveId} = ${hives.id}
            )`,
          })
          .from(hiveMembers)
          .innerJoin(hives, eq(hiveMembers.hiveId, hives.id))
          .where(eq(hiveMembers.userId, ctx.user.id))
          .orderBy(desc(hives.createdAt));

        return list;
      } catch (error) {
        console.error('Error in getUserHives:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve user hives.',
        });
      }
    }),

  updateHive: protectedProcedure
    .input(updateHiveInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'admin', input.hiveId);

        const updateData: Partial<typeof hives.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.courseCode !== undefined) updateData.courseCode = input.courseCode;
        if (input.colorTheme !== undefined) updateData.colorTheme = input.colorTheme;
        if (input.feedSettings !== undefined) updateData.feedSettings = input.feedSettings;

        const [updated] = await ctx.db
          .update(hives)
          .set(updateData)
          .where(eq(hives.id, input.hiveId))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Hive not found or update failed.',
          });
        }

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in updateHive:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update hive.',
        });
      }
    }),

  deleteHive: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'owner', input.hiveId);

        const [deleted] = await ctx.db
          .delete(hives)
          .where(eq(hives.id, input.hiveId))
          .returning();

        if (!deleted) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Hive not found or deletion failed.',
          });
        }

        return deleted;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in deleteHive:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete hive.',
        });
      }
    }),

  getHiveOverview: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'viewer', input.hiveId);

        // Fetch recent announcements joined with author info
        const recentAnnouncements = await ctx.db
          .select({
            id: announcements.id,
            hiveId: announcements.hiveId,
            authorId: announcements.authorId,
            title: announcements.title,
            body: announcements.body,
            createdAt: announcements.createdAt,
            updatedAt: announcements.updatedAt,
            author: {
              fullName: users.fullName,
              avatarUrl: users.avatarUrl,
            },
          })
          .from(announcements)
          .innerJoin(users, eq(announcements.authorId, users.id))
          .where(eq(announcements.hiveId, input.hiveId))
          .orderBy(desc(announcements.createdAt))
          .limit(3);

        // Fetch upcoming deadlines (tasks with dueAt in the future and not done)
        const upcomingDeadlines = await ctx.db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.hiveId, input.hiveId),
              sql`${tasks.dueAt} >= now()`,
              sql`${tasks.status} != 'done'`
            )
          )
          .orderBy(tasks.dueAt)
          .limit(5);

        // Fetch recent activity logs joined with actor info
        const recentActivity = await ctx.db
          .select({
            id: activityLog.id,
            hiveId: activityLog.hiveId,
            actorId: activityLog.actorId,
            actionType: activityLog.actionType,
            entityType: activityLog.entityType,
            entityId: activityLog.entityId,
            meta: activityLog.meta,
            createdAt: activityLog.createdAt,
            actor: {
              fullName: users.fullName,
              avatarUrl: users.avatarUrl,
            },
          })
          .from(activityLog)
          .innerJoin(users, eq(activityLog.actorId, users.id))
          .where(eq(activityLog.hiveId, input.hiveId))
          .orderBy(desc(activityLog.createdAt))
          .limit(10);

        // Fetch materials count
        const [materialsCountResult] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hiveMaterialShares)
          .where(eq(hiveMaterialShares.hiveId, input.hiveId));

        // Fetch members count
        const [memberCountResult] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hiveMembers)
          .where(eq(hiveMembers.hiveId, input.hiveId));

        return {
          announcements: recentAnnouncements,
          deadlines: upcomingDeadlines,
          activity: recentActivity,
          materialsCount: materialsCountResult?.count ?? 0,
          memberCount: memberCountResult?.count ?? 0,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getHiveOverview:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve hive overview data.',
        });
      }
    }),
});

