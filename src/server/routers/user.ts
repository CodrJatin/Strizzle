import { createTRPCRouter, protectedProcedure } from '../trpc';
import { users, userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import {
  completeOnboardingSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from '@/types/user';

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
      email: ctx.user.email ?? null,
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

        // Set the theme cookie upon successful onboarding
        const cookieStore = await cookies();
        cookieStore.set('strizzle-theme', input.theme, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365, // 1 year
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
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

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [preferences] = await ctx.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);

    if (!preferences) {
      return {
        theme: 'default',
        defaultCalView: 'week',
      };
    }

    return preferences;
  }),

  updatePreferences: protectedProcedure
    .input(updatePreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: Partial<typeof userPreferences.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (input.theme !== undefined) {
          updateData.theme = input.theme;
        }
        if (input.defaultCalView !== undefined) {
          updateData.defaultCalView = input.defaultCalView;
        }

        const [result] = await ctx.db
          .insert(userPreferences)
          .values({
            userId: ctx.user.id,
            theme: input.theme || 'default',
            defaultCalView: input.defaultCalView || 'week',
          })
          .onConflictDoUpdate({
            target: userPreferences.userId,
            set: updateData,
          })
          .returning();

        // If theme is updated, sync it to the cookie
        if (input.theme !== undefined) {
          const cookieStore = await cookies();
          cookieStore.set('strizzle-theme', input.theme, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        }

        return result;
      } catch (error) {
        console.error("Failed to update preferences", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update preferences. Please try again.',
        });
      }
    }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: Record<string, any> = {
          fullName: input.fullName,
          updatedAt: new Date(),
        };

        if (input.avatarUrl !== undefined) {
          updateData.avatarUrl = input.avatarUrl;
        }

        const [result] = await ctx.db
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id))
          .returning();

        return result;
      } catch (error) {
        console.error("Failed to update profile", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update profile. Please try again.',
        });
      }
    }),
});
