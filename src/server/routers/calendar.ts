import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { tasks, hiveMembers, hives } from '@/db/schema';
import { eq, and, or, inArray, sql, isNotNull, gte, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const getCalendarTasksSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const calendarRouter = createTRPCRouter({
  getCalendarTasks: protectedProcedure
    .input(getCalendarTasksSchema)
    .query(async ({ ctx, input }) => {
      try {
        const userHives = await ctx.db
          .select({ hiveId: hiveMembers.hiveId })
          .from(hiveMembers)
          .where(eq(hiveMembers.userId, ctx.user.id));
        const hiveIds = userHives.map((h) => h.hiveId);

        const conditions = [
          isNotNull(tasks.dueAt),
          gte(tasks.dueAt, new Date(input.start)),
          lte(tasks.dueAt, new Date(input.end)),
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
          .where(and(...conditions));
      } catch (error) {
        console.error("Error in getCalendarTasks:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve calendar tasks.',
        });
      }
    }),
});
