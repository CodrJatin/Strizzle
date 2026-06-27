import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { hives, hiveMembers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const hiveRouter = createTRPCRouter({
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
          })
          .from(hiveMembers)
          .innerJoin(hives, eq(hiveMembers.hiveId, hives.id))
          .where(eq(hiveMembers.userId, ctx.user.id))
          .orderBy(desc(hives.createdAt));

        return list;
      } catch (error) {
        console.error("Error in getUserHives:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve user hives.',
        });
      }
    }),
});
