import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { announcements, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/logActivity';

export const createAnnouncementInputSchema = z.object({
  hiveId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  body: z.string().min(1, 'Body is required'),
});

export const announcementRouter = createTRPCRouter({
  createAnnouncement: protectedProcedure
    .input(createAnnouncementInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'admin', input.hiveId);

        const [announcement] = await ctx.db
          .insert(announcements)
          .values({
            hiveId: input.hiveId,
            authorId: ctx.user.id,
            title: input.title,
            body: input.body,
          })
          .returning();

        if (!announcement) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to post announcement.',
          });
        }

        // Log activity
        await logActivity(ctx.db, {
          hiveId: input.hiveId,
          actorId: ctx.user.id,
          actionType: 'announcement_created',
          entityType: 'announcement',
          entityId: announcement.id,
          meta: {
            title: announcement.title,
          },
        });

        return announcement;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in createAnnouncement:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to post announcement.',
        });
      }
    }),

  getAnnouncements: protectedProcedure
    .input(
      z.object({
        hiveId: z.string().uuid(),
        limit: z.number().min(1).max(50).default(10),
        cursor: z.number().nullish(), // Paginated by offset
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        await enforceRole(ctx, 'viewer', input.hiveId);

        const offset = input.cursor ?? 0;

        const list = await ctx.db
          .select({
            id: announcements.id,
            hiveId: announcements.hiveId,
            title: announcements.title,
            body: announcements.body,
            createdAt: announcements.createdAt,
            author: {
              id: users.id,
              fullName: users.fullName,
              avatarUrl: users.avatarUrl,
            },
          })
          .from(announcements)
          .innerJoin(users, eq(announcements.authorId, users.id))
          .where(eq(announcements.hiveId, input.hiveId))
          .orderBy(desc(announcements.createdAt))
          .limit(input.limit)
          .offset(offset);

        const nextCursor = list.length === input.limit ? offset + input.limit : null;

        return {
          items: list,
          nextCursor,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getAnnouncements:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve announcements.',
        });
      }
    }),

  deleteAnnouncement: protectedProcedure
    .input(z.object({ announcementId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [announcement] = await ctx.db
          .select()
          .from(announcements)
          .where(eq(announcements.id, input.announcementId))
          .limit(1);

        if (!announcement) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Announcement not found.',
          });
        }

        // Caller must be admin or author
        const callerMember = await enforceRole(ctx, 'viewer', announcement.hiveId);
        const isAuthor = announcement.authorId === ctx.user.id;
        const isAdminPlus = callerMember.role === 'owner' || callerMember.role === 'admin';

        if (!isAuthor && !isAdminPlus) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions.',
          });
        }

        const [deleted] = await ctx.db
          .delete(announcements)
          .where(eq(announcements.id, input.announcementId))
          .returning();

        return deleted;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in deleteAnnouncement:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete announcement.',
        });
      }
    }),
});
