import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const registerSubscriptionSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL format"),
  p256dhKey: z.string().min(1, "p256dh key is required"),
  authKey: z.string().min(1, "auth key is required"),
  deviceLabel: z.string().optional(),
});

export const unregisterSubscriptionSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL format"),
});

export const pushRouter = createTRPCRouter({
  registerSubscription: protectedProcedure
    .input(registerSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if subscription already exists for this endpoint
        const [existing] = await ctx.db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint))
          .limit(1);

        if (existing) {
          const [updated] = await ctx.db
            .update(pushSubscriptions)
            .set({
              p256dhKey: input.p256dhKey,
              authKey: input.authKey,
              deviceLabel: input.deviceLabel ?? existing.deviceLabel,
              lastUsedAt: new Date(),
            })
            .where(eq(pushSubscriptions.endpoint, input.endpoint))
            .returning();
          return updated;
        }

        const [inserted] = await ctx.db
          .insert(pushSubscriptions)
          .values({
            userId: ctx.user.id,
            endpoint: input.endpoint,
            p256dhKey: input.p256dhKey,
            authKey: input.authKey,
            deviceLabel: input.deviceLabel,
            lastUsedAt: new Date(),
          })
          .returning();

        if (!inserted) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to save push subscription.',
          });
        }

        return inserted;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error('Error registering push subscription:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while saving the push subscription.',
        });
      }
    }),

  unregisterSubscription: protectedProcedure
    .input(unregisterSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [deleted] = await ctx.db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint))
          .returning();
        
        return { success: !!deleted };
      } catch (err) {
        console.error('Error unregistering push subscription:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while deleting the push subscription.',
        });
      }
    }),
});
