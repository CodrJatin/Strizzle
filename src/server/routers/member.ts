import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { hiveMembers, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/logActivity';

export const changeRoleInputSchema = z.object({
  hiveId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export const memberRouter = createTRPCRouter({
  getHiveMembers: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'viewer', input.hiveId);

        const list = await ctx.db
          .select({
            userId: hiveMembers.userId,
            hiveId: hiveMembers.hiveId,
            role: hiveMembers.role,
            joinedAt: hiveMembers.joinedAt,
            user: {
              id: users.id,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl,
            },
          })
          .from(hiveMembers)
          .innerJoin(users, eq(hiveMembers.userId, users.id))
          .where(eq(hiveMembers.hiveId, input.hiveId))
          .orderBy(users.fullName);

        return list;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getHiveMembers:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve hive members.',
        });
      }
    }),

  changeRole: protectedProcedure
    .input(changeRoleInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Enforce that caller is at least admin
        const callerMember = await enforceRole(ctx, 'admin', input.hiveId);

        // Fetch target member's current role
        const [targetMember] = await ctx.db
          .select()
          .from(hiveMembers)
          .where(
            and(
              eq(hiveMembers.hiveId, input.hiveId),
              eq(hiveMembers.userId, input.userId)
            )
          )
          .limit(1);

        if (!targetMember) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Target member not found in this hive.',
          });
        }

        // Caller cannot change their own role
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You cannot change your own role.',
          });
        }

        // If target is the owner, block modification
        if (targetMember.role === 'owner') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot modify the role of the hive owner.',
          });
        }

        // If caller is an admin, they cannot modify another admin's role
        if (callerMember.role === 'admin' && targetMember.role === 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admins cannot change the role of other admins.',
          });
        }

        // Perform the role update
        const [updated] = await ctx.db
          .update(hiveMembers)
          .set({ role: input.role })
          .where(
            and(
              eq(hiveMembers.hiveId, input.hiveId),
              eq(hiveMembers.userId, input.userId)
            )
          )
          .returning();

        // Log role change activity
        await logActivity(ctx.db, {
          hiveId: input.hiveId,
          actorId: ctx.user.id,
          actionType: 'role_changed',
          entityType: 'user',
          entityId: input.userId,
          meta: {
            newRole: input.role,
            oldRole: targetMember.role,
          },
        });

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in changeRole:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update member role.',
        });
      }
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        hiveId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const callerMember = await enforceRole(ctx, 'admin', input.hiveId);

        // Fetch target member
        const [targetMember] = await ctx.db
          .select()
          .from(hiveMembers)
          .where(
            and(
              eq(hiveMembers.hiveId, input.hiveId),
              eq(hiveMembers.userId, input.userId)
            )
          )
          .limit(1);

        if (!targetMember) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Target member not found in this hive.',
          });
        }

        // Self-removal logic handled gracefully
        if (input.userId === ctx.user.id) {
          if (callerMember.role === 'owner') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Owner cannot leave the hive. You must transfer ownership first.',
            });
          }

          const [removed] = await ctx.db
            .delete(hiveMembers)
            .where(
              and(
                eq(hiveMembers.hiveId, input.hiveId),
                eq(hiveMembers.userId, input.userId)
              )
            )
            .returning();
          return removed;
        }

        // If removing someone else:
        if (targetMember.role === 'owner') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot remove the hive owner.',
          });
        }

        if (callerMember.role === 'admin' && targetMember.role === 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admins cannot remove other admins.',
          });
        }

        const [removed] = await ctx.db
          .delete(hiveMembers)
          .where(
            and(
              eq(hiveMembers.hiveId, input.hiveId),
              eq(hiveMembers.userId, input.userId)
            )
          )
          .returning();

        return removed;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in removeMember:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove member.',
        });
      }
    }),

  leaveHive: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const member = await enforceRole(ctx, 'viewer', input.hiveId);

        if (member.role === 'owner') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Owner cannot leave the hive. You must transfer ownership first.',
          });
        }

        const [left] = await ctx.db
          .delete(hiveMembers)
          .where(
            and(
              eq(hiveMembers.hiveId, input.hiveId),
              eq(hiveMembers.userId, ctx.user.id)
            )
          )
          .returning();

        return left;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in leaveHive:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to leave hive.',
        });
      }
    }),
});
