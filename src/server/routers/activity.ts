import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { activityLog, users, hives, hiveMembers, materials, tasks, announcements } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

async function enrichActivities(db: any, items: any[]) {
  if (items.length === 0) return items;

  const materialIds = Array.from(
    new Set(
      items
        .filter((i) => i.entityType === 'material' && i.entityId)
        .map((i) => i.entityId as string)
    )
  );
  const taskIds = Array.from(
    new Set(
      items
        .filter((i) => i.entityType === 'task' && i.entityId)
        .map((i) => i.entityId as string)
    )
  );
  const announcementIds = Array.from(
    new Set(
      items
        .filter((i) => i.entityType === 'announcement' && i.entityId)
        .map((i) => i.entityId as string)
    )
  );

  const [materialsList, tasksList, announcementsList] = await Promise.all([
    materialIds.length > 0
      ? db.select().from(materials).where(inArray(materials.id, materialIds))
      : Promise.resolve([]),
    taskIds.length > 0
      ? db.select().from(tasks).where(inArray(tasks.id, taskIds))
      : Promise.resolve([]),
    announcementIds.length > 0
      ? db.select().from(announcements).where(inArray(announcements.id, announcementIds))
      : Promise.resolve([]),
  ]);

  const materialsMap = new Map(materialsList.map((m: any) => [m.id, m]));
  const tasksMap = new Map(tasksList.map((t: any) => [t.id, t]));
  const announcementsMap = new Map(announcementsList.map((a: any) => [a.id, a]));

  return items.map((item) => {
    let entity = null;
    if (item.entityType === 'material' && item.entityId) {
      entity = { material: materialsMap.get(item.entityId) || null };
    } else if (item.entityType === 'task' && item.entityId) {
      entity = { task: tasksMap.get(item.entityId) || null };
    } else if (item.entityType === 'announcement' && item.entityId) {
      entity = { announcement: announcementsMap.get(item.entityId) || null };
    }
    return {
      ...item,
      entity,
    };
  });
}

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

        const enrichedItems = await enrichActivities(ctx.db, items);

        return { items: enrichedItems };
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

        const enrichedItems = await enrichActivities(ctx.db, items);

        return { items: enrichedItems };
      } catch (error) {
        console.error('Error in getFeed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve community feed.',
        });
      }
    }),
});

