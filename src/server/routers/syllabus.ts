import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { syllabusUnits, syllabusTopics, syllabusProgress, hiveMembers, users } from '@/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/logActivity';

export const getSyllabusSchema = z.object({
  hiveId: z.string().uuid(),
});

export const createUnitSchema = z.object({
  hiveId: z.string().uuid(),
  title: z.string().min(1, "Unit title is required").max(200),
});

export const updateUnitSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
});

export const deleteUnitSchema = z.object({
  id: z.string().uuid(),
});

export const reorderUnitsSchema = z.object({
  hiveId: z.string().uuid(),
  unitIds: z.array(z.string().uuid()),
});

export const createTopicSchema = z.object({
  unitId: z.string().uuid(),
  title: z.string().min(1, "Topic title is required").max(200),
  materialId: z.string().uuid().optional().nullable(),
});

export const updateTopicSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  materialId: z.string().uuid().optional().nullable(),
});

export const deleteTopicSchema = z.object({
  id: z.string().uuid(),
});

export const reorderTopicsSchema = z.object({
  unitId: z.string().uuid(),
  topicIds: z.array(z.string().uuid()),
});

export const toggleTopicCompleteSchema = z.object({
  topicId: z.string().uuid(),
  completed: z.boolean(),
});

export const syllabusRouter = createTRPCRouter({
  getSyllabus: protectedProcedure
    .input(getSyllabusSchema)
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'viewer', input.hiveId);

        // Fetch units
        const units = await ctx.db
          .select()
          .from(syllabusUnits)
          .where(eq(syllabusUnits.hiveId, input.hiveId))
          .orderBy(asc(syllabusUnits.position), asc(syllabusUnits.createdAt));

        // Fetch topics
        const topics = await ctx.db
          .select()
          .from(syllabusTopics)
          .where(eq(syllabusTopics.hiveId, input.hiveId))
          .orderBy(asc(syllabusTopics.position), asc(syllabusTopics.createdAt));

        // Fetch progress for current user
        const progress = await ctx.db
          .select()
          .from(syllabusProgress)
          .where(eq(syllabusProgress.userId, ctx.user.id));

        const completedTopicIds = new Set(progress.map((p) => p.topicId));

        // Assemble tree structure
        return units.map((unit) => {
          const unitTopics = topics
            .filter((t) => t.unitId === unit.id)
            .map((t) => ({
              ...t,
              completed: completedTopicIds.has(t.id),
            }));

          return {
            ...unit,
            topics: unitTopics,
          };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in getSyllabus:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve syllabus tree.',
        });
      }
    }),

  createUnit: protectedProcedure
    .input(createUnitSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'member', input.hiveId);

        return await ctx.db.transaction(async (tx) => {
          // Get max position
          const [maxPosResult] = await tx
            .select({ maxPos: sql<number>`COALESCE(MAX(${syllabusUnits.position}), 0)` })
            .from(syllabusUnits)
            .where(eq(syllabusUnits.hiveId, input.hiveId));

          const nextPos = (maxPosResult?.maxPos || 0) + 1;

          const [unit] = await tx
            .insert(syllabusUnits)
            .values({
              hiveId: input.hiveId,
              title: input.title,
              position: nextPos,
              createdBy: ctx.user.id,
            })
            .returning();

          if (!unit) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to create unit.',
            });
          }

          await logActivity(tx, {
            hiveId: input.hiveId,
            actorId: ctx.user.id,
            actionType: 'syllabus_unit_created',
            entityType: 'syllabus_unit',
            entityId: unit.id,
          });

          return unit;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in createUnit:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the unit.',
        });
      }
    }),

  updateUnit: protectedProcedure
    .input(updateUnitSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch unit to get hiveId
        const [unit] = await ctx.db
          .select()
          .from(syllabusUnits)
          .where(eq(syllabusUnits.id, input.id))
          .limit(1);

        if (!unit) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Unit not found.',
          });
        }

        await enforceRole(ctx, 'member', unit.hiveId);

        const [updatedUnit] = await ctx.db
          .update(syllabusUnits)
          .set({
            title: input.title,
            updatedAt: new Date(),
          })
          .where(eq(syllabusUnits.id, input.id))
          .returning();

        await logActivity(ctx.db, {
          hiveId: unit.hiveId,
          actorId: ctx.user.id,
          actionType: 'syllabus_unit_updated',
          entityType: 'syllabus_unit',
          entityId: unit.id,
        });

        return updatedUnit;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in updateUnit:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update the unit.',
        });
      }
    }),

  deleteUnit: protectedProcedure
    .input(deleteUnitSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [unit] = await ctx.db
          .select()
          .from(syllabusUnits)
          .where(eq(syllabusUnits.id, input.id))
          .limit(1);

        if (!unit) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Unit not found.',
          });
        }

        await enforceRole(ctx, 'member', unit.hiveId);

        await ctx.db
          .delete(syllabusUnits)
          .where(eq(syllabusUnits.id, input.id));

        await logActivity(ctx.db, {
          hiveId: unit.hiveId,
          actorId: ctx.user.id,
          actionType: 'syllabus_unit_deleted',
          entityType: 'syllabus_unit',
          entityId: unit.id,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in deleteUnit:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete the unit.',
        });
      }
    }),

  reorderUnits: protectedProcedure
    .input(reorderUnitsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'member', input.hiveId);

        return await ctx.db.transaction(async (tx) => {
          for (let index = 0; index < input.unitIds.length; index++) {
            const unitId = input.unitIds[index];
            await tx
              .update(syllabusUnits)
              .set({ position: index, updatedAt: new Date() })
              .where(
                and(
                  eq(syllabusUnits.id, unitId),
                  eq(syllabusUnits.hiveId, input.hiveId)
                )
              );
          }
          return { success: true };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in reorderUnits:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reorder units.',
        });
      }
    }),

  createTopic: protectedProcedure
    .input(createTopicSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [unit] = await ctx.db
          .select()
          .from(syllabusUnits)
          .where(eq(syllabusUnits.id, input.unitId))
          .limit(1);

        if (!unit) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Associated syllabus unit not found.',
          });
        }

        await enforceRole(ctx, 'member', unit.hiveId);

        return await ctx.db.transaction(async (tx) => {
          // Get next position
          const [maxPosResult] = await tx
            .select({ maxPos: sql<number>`COALESCE(MAX(${syllabusTopics.position}), 0)` })
            .from(syllabusTopics)
            .where(
              and(
                eq(syllabusTopics.unitId, input.unitId),
                eq(syllabusTopics.hiveId, unit.hiveId)
              )
            );

          const nextPos = (maxPosResult?.maxPos || 0) + 1;

          const [topic] = await tx
            .insert(syllabusTopics)
            .values({
              unitId: input.unitId,
              hiveId: unit.hiveId,
              title: input.title,
              materialId: input.materialId || null,
              position: nextPos,
            })
            .returning();

          if (!topic) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to create topic.',
            });
          }

          await logActivity(tx, {
            hiveId: unit.hiveId,
            actorId: ctx.user.id,
            actionType: 'syllabus_topic_created',
            entityType: 'syllabus_topic',
            entityId: topic.id,
          });

          return topic;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in createTopic:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the topic.',
        });
      }
    }),

  updateTopic: protectedProcedure
    .input(updateTopicSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [topic] = await ctx.db
          .select()
          .from(syllabusTopics)
          .where(eq(syllabusTopics.id, input.id))
          .limit(1);

        if (!topic) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Topic not found.',
          });
        }

        await enforceRole(ctx, 'member', topic.hiveId);

        const updates: Partial<typeof syllabusTopics.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (input.title !== undefined) updates.title = input.title;
        if (input.materialId !== undefined) updates.materialId = input.materialId;

        const [updatedTopic] = await ctx.db
          .update(syllabusTopics)
          .set(updates)
          .where(eq(syllabusTopics.id, input.id))
          .returning();

        await logActivity(ctx.db, {
          hiveId: topic.hiveId,
          actorId: ctx.user.id,
          actionType: 'syllabus_topic_updated',
          entityType: 'syllabus_topic',
          entityId: topic.id,
        });

        return updatedTopic;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in updateTopic:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update the topic.',
        });
      }
    }),

  deleteTopic: protectedProcedure
    .input(deleteTopicSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [topic] = await ctx.db
          .select()
          .from(syllabusTopics)
          .where(eq(syllabusTopics.id, input.id))
          .limit(1);

        if (!topic) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Topic not found.',
          });
        }

        await enforceRole(ctx, 'member', topic.hiveId);

        await ctx.db
          .delete(syllabusTopics)
          .where(eq(syllabusTopics.id, input.id));

        await logActivity(ctx.db, {
          hiveId: topic.hiveId,
          actorId: ctx.user.id,
          actionType: 'syllabus_topic_deleted',
          entityType: 'syllabus_topic',
          entityId: topic.id,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in deleteTopic:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete the topic.',
        });
      }
    }),

  reorderTopics: protectedProcedure
    .input(reorderTopicsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [unit] = await ctx.db
          .select()
          .from(syllabusUnits)
          .where(eq(syllabusUnits.id, input.unitId))
          .limit(1);

        if (!unit) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Unit not found.',
          });
        }

        await enforceRole(ctx, 'member', unit.hiveId);

        return await ctx.db.transaction(async (tx) => {
          for (let index = 0; index < input.topicIds.length; index++) {
            const topicId = input.topicIds[index];
            await tx
              .update(syllabusTopics)
              .set({
                unitId: input.unitId,
                position: index,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(syllabusTopics.id, topicId),
                  eq(syllabusTopics.hiveId, unit.hiveId)
                )
              );
          }
          return { success: true };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in reorderTopics:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reorder topics.',
        });
      }
    }),

  toggleTopicComplete: protectedProcedure
    .input(toggleTopicCompleteSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [topic] = await ctx.db
          .select()
          .from(syllabusTopics)
          .where(eq(syllabusTopics.id, input.topicId))
          .limit(1);

        if (!topic) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Topic not found.',
          });
        }

        await enforceRole(ctx, 'viewer', topic.hiveId);

        if (input.completed) {
          await ctx.db
            .insert(syllabusProgress)
            .values({
              userId: ctx.user.id,
              topicId: input.topicId,
              completedAt: new Date(),
            })
            .onConflictDoNothing();
        } else {
          await ctx.db
            .delete(syllabusProgress)
            .where(
              and(
                eq(syllabusProgress.userId, ctx.user.id),
                eq(syllabusProgress.topicId, input.topicId)
              )
            );
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in toggleTopicComplete:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to toggle topic completion.',
        });
      }
    }),

  getProgressStats: protectedProcedure
    .input(getSyllabusSchema)
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'admin', input.hiveId);

        // Fetch hive member count
        const [memberCountResult] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hiveMembers)
          .where(eq(hiveMembers.hiveId, input.hiveId));

        const totalMembers = memberCountResult?.count || 0;

        // Fetch completion count per topic
        const stats = await ctx.db
          .select({
            topicId: syllabusProgress.topicId,
            completionCount: sql<number>`count(*)::int`,
          })
          .from(syllabusProgress)
          .innerJoin(syllabusTopics, eq(syllabusProgress.topicId, syllabusTopics.id))
          .where(eq(syllabusTopics.hiveId, input.hiveId))
          .groupBy(syllabusProgress.topicId);

        const topicStatsMap = stats.reduce((acc, stat) => {
          acc[stat.topicId] = stat.completionCount;
          return acc;
        }, {} as Record<string, number>);

        return {
          totalMembers,
          topicStats: topicStatsMap,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in getProgressStats:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve progress statistics.',
        });
      }
    }),
});
