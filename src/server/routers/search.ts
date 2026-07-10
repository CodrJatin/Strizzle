import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { materials, tasks, syllabusTopics, hiveMembers, hives } from '@/db/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const globalSearchSchema = z.object({
  query: z.string().default(''),
});

export const searchRouter = createTRPCRouter({
  globalSearch: protectedProcedure
    .input(globalSearchSchema)
    .query(async ({ ctx, input }) => {
      try {
        const queryStr = input.query.trim();
        if (!queryStr) {
          return {
            materials: [],
            tasks: [],
            syllabus: [],
          };
        }

        // 1. Fetch hives the current user belongs to
        const userHives = await ctx.db
          .select({ hiveId: hiveMembers.hiveId })
          .from(hiveMembers)
          .where(eq(hiveMembers.userId, ctx.user.id));
        const hiveIds = userHives.map((h) => h.hiveId);

        // 2. Search Materials (owned by the user)
        const materialsResults = await ctx.db
          .select({
            id: materials.id,
            title: materials.title,
            contentType: materials.contentType,
            body: materials.body,
            fileName: materials.fileName,
            tags: materials.tags,
          })
          .from(materials)
          .where(
            and(
              eq(materials.ownerId, ctx.user.id),
              sql`${materials.searchVec} @@ plainto_tsquery('english', ${queryStr})`
            )
          )
          .limit(10);

        // 3. Search Tasks (assigned to, created by, or inside user's hives)
        const taskAccessConditions = [
          eq(tasks.creatorId, ctx.user.id),
          eq(tasks.assigneeId, ctx.user.id),
        ];
        if (hiveIds.length > 0) {
          taskAccessConditions.push(inArray(tasks.hiveId, hiveIds));
        }

        const tasksResults = await ctx.db
          .select({
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            hiveId: tasks.hiveId,
            hiveName: hives.name,
            courseCode: hives.courseCode,
          })
          .from(tasks)
          .leftJoin(hives, eq(tasks.hiveId, hives.id))
          .where(
            and(
              or(...taskAccessConditions),
              sql`${tasks.searchVec} @@ plainto_tsquery('english', ${queryStr})`
            )
          )
          .limit(10);

        // 4. Search Syllabus Topics (belonging to hives user is in)
        let syllabusResults: any[] = [];
        if (hiveIds.length > 0) {
          syllabusResults = await ctx.db
            .select({
              id: syllabusTopics.id,
              title: syllabusTopics.title,
              hiveId: syllabusTopics.hiveId,
              hiveName: hives.name,
              courseCode: hives.courseCode,
            })
            .from(syllabusTopics)
            .leftJoin(hives, eq(syllabusTopics.hiveId, hives.id))
            .where(
              and(
                inArray(syllabusTopics.hiveId, hiveIds),
                sql`${syllabusTopics.searchVec} @@ plainto_tsquery('english', ${queryStr})`
              )
            )
            .limit(10);
        }

        return {
          materials: materialsResults,
          tasks: tasksResults,
          syllabus: syllabusResults,
        };
      } catch (error) {
        console.error("Error in globalSearch:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute search.',
        });
      }
    }),
});
