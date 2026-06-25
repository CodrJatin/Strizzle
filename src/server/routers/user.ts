import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { users, userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const completeOnboardingSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
  avatarUrl: z.string().nullable(),
  theme: z.string().default('default'),
});

export const userRouter = createTRPCRouter({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) {
      return null;
    }

    const [preferences] = await ctx.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);

    return {
      ...user,
      preferences: preferences || null,
    };
  }),

  completeOnboarding: protectedProcedure
    .input(completeOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await tx.insert(users)
            .values({
              id: ctx.user.id,
              fullName: input.fullName,
              avatarUrl: input.avatarUrl,
            })
            .onConflictDoUpdate({
              target: users.id,
              set: {
                fullName: input.fullName,
                avatarUrl: input.avatarUrl,
                updatedAt: new Date(),
              },
            });

          await tx.insert(userPreferences)
            .values({
              userId: ctx.user.id,
              theme: input.theme,
            })
            .onConflictDoUpdate({
              target: userPreferences.userId,
              set: {
                theme: input.theme,
                updatedAt: new Date(),
              },
            });
        });
        return { success: true };
      } catch (error) {
        console.error("Failed to complete onboarding", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to complete onboarding. Please try again.',
        });
      }
    }),
});
