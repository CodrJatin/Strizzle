import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure, enforceRole } from '../trpc';
import { hives, hiveInvites, hiveMembers } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/logActivity';
import { sendInviteEmail } from '../email/sendInviteEmail';

export const generateInviteInputSchema = z.object({
  hiveId: z.string().uuid(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  expiresAt: z.string().datetime().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const inviteRouter = createTRPCRouter({
  getInviteByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const [invite] = await ctx.db
          .select({
            id: hiveInvites.id,
            role: hiveInvites.role,
            expiresAt: hiveInvites.expiresAt,
            revokedAt: hiveInvites.revokedAt,
            maxUses: hiveInvites.maxUses,
            useCount: hiveInvites.useCount,
            hiveName: hives.name,
            courseCode: hives.courseCode,
            hiveId: hiveInvites.hiveId,
          })
          .from(hiveInvites)
          .innerJoin(hives, eq(hiveInvites.hiveId, hives.id))
          .where(eq(hiveInvites.token, input.token))
          .limit(1);

        if (!invite) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invite link not found.',
          });
        }

        let isAlreadyMember = false;
        if (ctx.user) {
          const [member] = await ctx.db
            .select()
            .from(hiveMembers)
            .where(
              and(
                eq(hiveMembers.hiveId, invite.hiveId),
                eq(hiveMembers.userId, ctx.user.id)
              )
            )
            .limit(1);
          isAlreadyMember = !!member;
        }

        const [memberCountResult] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(hiveMembers)
          .where(eq(hiveMembers.hiveId, invite.hiveId));
        const memberCount = memberCountResult?.count || 0;

        return {
          ...invite,
          isAlreadyMember,
          memberCount,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getInviteByToken:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve invite details.',
        });
      }
    }),
  generateInviteLink: protectedProcedure
    .input(generateInviteInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'admin', input.hiveId);

        const token = crypto.randomUUID();
        const [invite] = await ctx.db
          .insert(hiveInvites)
          .values({
            hiveId: input.hiveId,
            createdBy: ctx.user.id,
            token,
            role: input.role,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            maxUses: input.maxUses ?? null,
            useCount: 0,
          })
          .returning();

        if (!invite) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to generate invite link.',
          });
        }

        // Send email invite if an email is provided
        if (input.email) {
          const [hive] = await ctx.db
            .select({ name: hives.name })
            .from(hives)
            .where(eq(hives.id, input.hiveId))
            .limit(1);

          if (!hive) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Hive not found.',
            });
          }

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const inviteUrl = `${baseUrl}/invite/${invite.token}`;

          await sendInviteEmail({
            toEmail: input.email,
            hiveName: hive.name,
            role: invite.role,
            inviteUrl,
          });
        }

        return invite;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in generateInviteLink:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate invite link.',
        });
      }
    }),

  listInvites: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'admin', input.hiveId);

        const list = await ctx.db
          .select()
          .from(hiveInvites)
          .where(eq(hiveInvites.hiveId, input.hiveId))
          .orderBy(desc(hiveInvites.createdAt));

        return list;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in listInvites:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list invite links.',
        });
      }
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [invite] = await ctx.db
          .select()
          .from(hiveInvites)
          .where(eq(hiveInvites.id, input.inviteId))
          .limit(1);

        if (!invite) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invite link not found.',
          });
        }

        await enforceRole(ctx, 'admin', invite.hiveId);

        const [revoked] = await ctx.db
          .update(hiveInvites)
          .set({ revokedAt: new Date() })
          .where(eq(hiveInvites.id, input.inviteId))
          .returning();

        return revoked;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in revokeInvite:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to revoke invite link.',
        });
      }
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [invite] = await ctx.db
          .select()
          .from(hiveInvites)
          .where(eq(hiveInvites.token, input.token))
          .limit(1);

        if (!invite) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invite link is invalid.',
          });
        }

        if (invite.revokedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This invite link has been revoked.',
          });
        }

        if (invite.expiresAt && new Date() > invite.expiresAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This invite link has expired.',
          });
        }

        if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This invite link has reached its maximum uses.',
          });
        }

        // Check if the user is already a member of the hive
        const [existingMember] = await ctx.db
          .select()
          .from(hiveMembers)
          .where(
            and(
              eq(hiveMembers.hiveId, invite.hiveId),
              eq(hiveMembers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (existingMember) {
          return { hiveId: invite.hiveId, alreadyMember: true };
        }

        // Join the hive inside transaction
        const result = await ctx.db.transaction(async (tx) => {
          await tx
            .insert(hiveMembers)
            .values({
              hiveId: invite.hiveId,
              userId: ctx.user.id,
              role: invite.role,
            });

          await tx
            .update(hiveInvites)
            .set({ useCount: invite.useCount + 1 })
            .where(eq(hiveInvites.id, invite.id));

          await logActivity(tx, {
            hiveId: invite.hiveId,
            actorId: ctx.user.id,
            actionType: 'hive_joined',
            entityType: 'user',
            entityId: ctx.user.id,
            meta: {
              role: invite.role,
              inviteId: invite.id,
            },
          });

          return { hiveId: invite.hiveId, alreadyMember: false };
        });

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in acceptInvite:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to accept invite link.',
        });
      }
    }),
});
