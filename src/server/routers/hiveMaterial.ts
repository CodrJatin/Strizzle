import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { hiveMaterialShares, materials, users } from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/logActivity';

export const shareMaterialToHiveInputSchema = z.object({
  materialId: z.string().uuid(),
  hiveId: z.string().uuid(),
  folderId: z.string().uuid().nullable().optional(),
});

export const getHiveMaterialsInputSchema = z.object({
  hiveId: z.string().uuid(),
  folderId: z.string().uuid().nullable().optional(),
  limit: z.number().min(1).max(500).default(20),
  cursor: z.number().nullish(), // offset-based cursor
});

export const hiveMaterialRouter = createTRPCRouter({
  shareMaterialToHive: protectedProcedure
    .input(shareMaterialToHiveInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Enforce member role
        await enforceRole(ctx, 'member', input.hiveId);

        // Check if the material is already shared in this hive
        const [existing] = await ctx.db
          .select()
          .from(hiveMaterialShares)
          .where(
            and(
              eq(hiveMaterialShares.hiveId, input.hiveId),
              eq(hiveMaterialShares.materialId, input.materialId)
            )
          )
          .limit(1);

        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This material is already shared in the hive.',
          });
        }

        // Share the material
        const [share] = await ctx.db
          .insert(hiveMaterialShares)
          .values({
            hiveId: input.hiveId,
            materialId: input.materialId,
            sharedBy: ctx.user.id,
            folderId: input.folderId || null,
          })
          .returning();

        if (!share) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to share material to the hive.',
          });
        }

        // Log activity
        await logActivity(ctx.db, {
          hiveId: input.hiveId,
          actorId: ctx.user.id,
          actionType: 'material_created',
          entityType: 'material',
          entityId: input.materialId,
        });

        return share;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in shareMaterialToHive:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to share material.',
        });
      }
    }),

  getHiveMaterials: protectedProcedure
    .input(getHiveMaterialsInputSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Enforce viewer role
        await enforceRole(ctx, 'viewer', input.hiveId);

        const offset = input.cursor ?? 0;

        // Build folder filters
        const conditions = [eq(hiveMaterialShares.hiveId, input.hiveId)];
        if (input.folderId !== undefined) {
          if (input.folderId === null) {
            conditions.push(isNull(hiveMaterialShares.folderId));
          } else {
            conditions.push(eq(hiveMaterialShares.folderId, input.folderId));
          }
        }

        const list = await ctx.db
          .select({
            id: hiveMaterialShares.id,
            materialId: hiveMaterialShares.materialId,
            hiveId: hiveMaterialShares.hiveId,
            folderId: hiveMaterialShares.folderId,
            sharedAt: hiveMaterialShares.sharedAt,
            sharedBy: hiveMaterialShares.sharedBy,
            sharer: {
              fullName: users.fullName,
              avatarUrl: users.avatarUrl,
            },
            material: {
              id: materials.id,
              contentType: materials.contentType,
              title: materials.title,
              body: materials.body,
              url: materials.url,
              fileName: materials.fileName,
              fileSize: materials.fileSize,
              mimeType: materials.mimeType,
              createdAt: materials.createdAt,
              ogTitle: materials.ogTitle,
              ogDescription: materials.ogDescription,
              ogImage: materials.ogImage,
              ogDomain: materials.ogDomain,
              storagePath: materials.storagePath,
            },
          })
          .from(hiveMaterialShares)
          .innerJoin(materials, eq(hiveMaterialShares.materialId, materials.id))
          .innerJoin(users, eq(hiveMaterialShares.sharedBy, users.id))
          .where(and(...conditions))
          .orderBy(desc(hiveMaterialShares.sharedAt))
          .limit(input.limit)
          .offset(offset);

        const nextCursor = list.length === input.limit ? offset + input.limit : null;

        return {
          items: list,
          nextCursor,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getHiveMaterials:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve hive materials.',
        });
      }
    }),

  unshareMaterial: protectedProcedure
    .input(z.object({ shareId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Find the share details
        const [share] = await ctx.db
          .select()
          .from(hiveMaterialShares)
          .where(eq(hiveMaterialShares.id, input.shareId))
          .limit(1);

        if (!share) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Shared material record not found.',
          });
        }

        // Get caller's role in the hive
        const callerMember = await enforceRole(ctx, 'viewer', share.hiveId);

        // Access check: must be the sharer or an admin/owner
        const isSharer = share.sharedBy === ctx.user.id;
        const isAdminOrOwner = callerMember.role === 'admin' || callerMember.role === 'owner';

        if (!isSharer && !isAdminOrOwner) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to unshare this material.',
          });
        }

        // Delete the share
        const [deleted] = await ctx.db
          .delete(hiveMaterialShares)
          .where(eq(hiveMaterialShares.id, input.shareId))
          .returning();

        return deleted;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in unshareMaterial:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to unshare material.',
        });
      }
    }),
});
