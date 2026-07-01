import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, enforceRole } from '../trpc';
import { folders, hiveMaterialShares } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const createFolderInputSchema = z.object({
  hiveId: z.string().uuid(),
  name: z.string().min(1, 'Folder name is required').max(100, 'Folder name is too long'),
  parentId: z.string().uuid().nullable().optional(),
});

export const renameFolderInputSchema = z.object({
  folderId: z.string().uuid(),
  name: z.string().min(1, 'Folder name is required').max(100, 'Folder name is too long'),
});

export const folderRouter = createTRPCRouter({
  createFolder: protectedProcedure
    .input(createFolderInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Enforce member role
        await enforceRole(ctx, 'member', input.hiveId);

        const [folder] = await ctx.db
          .insert(folders)
          .values({
            hiveId: input.hiveId,
            name: input.name,
            parentId: input.parentId || null,
            createdBy: ctx.user.id,
          })
          .returning();

        if (!folder) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create folder.',
          });
        }

        return folder;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in createFolder:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create folder.',
        });
      }
    }),

  getHiveFolders: protectedProcedure
    .input(z.object({ hiveId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        // Enforce viewer role
        await enforceRole(ctx, 'viewer', input.hiveId);

        const list = await ctx.db
          .select()
          .from(folders)
          .where(eq(folders.hiveId, input.hiveId))
          .orderBy(folders.createdAt);

        return { items: list };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in getHiveFolders:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve folders.',
        });
      }
    }),

  renameFolder: protectedProcedure
    .input(renameFolderInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Find the folder first to check hiveId
        const [folder] = await ctx.db
          .select()
          .from(folders)
          .where(eq(folders.id, input.folderId))
          .limit(1);

        if (!folder) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Folder not found.',
          });
        }

        // Enforce member role
        await enforceRole(ctx, 'member', folder.hiveId);

        const [updated] = await ctx.db
          .update(folders)
          .set({ name: input.name })
          .where(eq(folders.id, input.folderId))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to rename folder.',
          });
        }

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in renameFolder:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to rename folder.',
        });
      }
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Find the folder first to get hiveId
        const [folder] = await ctx.db
          .select()
          .from(folders)
          .where(eq(folders.id, input.folderId))
          .limit(1);

        if (!folder) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Folder not found.',
          });
        }

        // Enforce member role
        await enforceRole(ctx, 'member', folder.hiveId);

        // Fetch all folders in the hive to resolve descendants
        const allFolders = await ctx.db
          .select()
          .from(folders)
          .where(eq(folders.hiveId, folder.hiveId));

        // Recursive helper to gather descendant folder IDs
        const getDescendantIds = (parentId: string): string[] => {
          const descendants: string[] = [parentId];
          const children = allFolders.filter((f) => f.parentId === parentId);
          for (const child of children) {
            descendants.push(...getDescendantIds(child.id));
          }
          return descendants;
        };

        const folderIdsToDelete = getDescendantIds(input.folderId);

        // Move all shared materials inside these folders to the root level (folderId = null)
        await ctx.db
          .update(hiveMaterialShares)
          .set({ folderId: null })
          .where(inArray(hiveMaterialShares.folderId, folderIdsToDelete));

        // Delete parent folder (database cascade constraint deletes descendant child folder rows automatically)
        const [deleted] = await ctx.db
          .delete(folders)
          .where(eq(folders.id, input.folderId))
          .returning();

        return deleted;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error in deleteFolder:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete folder.',
        });
      }
    }),
});
