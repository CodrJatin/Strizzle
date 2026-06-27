import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { tasks, taskMaterialRefs } from '@/db/schema';
import { TRPCError } from '@trpc/server';

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueAt: z.string().datetime().optional().nullable(),
  source: z.enum(['personal', 'hive_deadline', 'shelf_converted']).default('personal'),
  sourceRefId: z.string().uuid().optional().nullable(),
});

export const taskRouter = createTRPCRouter({
  createTask: protectedProcedure
    .input(createTaskSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [task] = await ctx.db
          .insert(tasks)
          .values({
            creatorId: ctx.user.id,
            assigneeId: ctx.user.id, // Personal task defaults assignee to creator
            title: input.title,
            description: input.description,
            priority: input.priority,
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
            source: input.source,
            sourceRefId: input.sourceRefId,
          })
          .returning();

        if (!task) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create task.',
          });
        }

        // If converted from a shelf material, create a reference link
        if (input.sourceRefId) {
          await ctx.db
            .insert(taskMaterialRefs)
            .values({
              taskId: task.id,
              materialId: input.sourceRefId,
            });
        }

        return task;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in createTask:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the task.',
        });
      }
    }),
});
