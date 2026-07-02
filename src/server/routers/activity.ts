import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { activityLog, users, hives, hiveMembers } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const activityRouter = createTRPCRouter({
  getHiveActivity: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'viewer', input.hiveId);

        const items = await ctx.db
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
          .orderBy(desc(activityLog.createdAt));

        return { items };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getHiveActivity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve activity log.',
        });
      }
    }),

  getFeed: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const userHives = await ctx.db
          .select({ hiveId: hiveMembers.hiveId })
          .from(hiveMembers)
          .where(eq(hiveMembers.userId, ctx.user.id));

        const hiveIds = userHives.map((h) => h.hiveId);
        if (hiveIds.length === 0) {
          return { items: [] };
        }

        const items = await ctx.db
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
            hiveName: hives.name,
            courseCode: hives.courseCode,
            colorTheme: hives.colorTheme,
          })
          .from(activityLog)
          .innerJoin(users, eq(activityLog.actorId, users.id))
          .innerJoin(hives, eq(activityLog.hiveId, hives.id))
          .where(inArray(activityLog.hiveId, hiveIds))
          .orderBy(desc(activityLog.createdAt))
          .limit(50);

        return { items };
      } catch (error) {
        console.error('Error in getFeed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve community feed.',
        });
      }
    }),
});
