import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { shelfItems, materials, libraryMaterials } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const createShelfItemSchema = z.object({
  materialId: z.string().uuid("Invalid material ID format"),
});

export const deleteShelfItemSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export const moveToLibrarySchema = z.object({
  shelfItemId: z.string().uuid("Invalid shelf item ID format"),
});

export const shelfRouter = createTRPCRouter({
  createShelfItem: protectedProcedure
    .input(createShelfItemSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Verify material exists and belongs to the user
        const [material] = await ctx.db
          .select()
          .from(materials)
          .where(eq(materials.id, input.materialId))
          .limit(1);

        if (!material) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Material not found.',
          });
        }

        if (material.ownerId !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not own this material.',
          });
        }

        // 2. Prevent duplicate entries on the shelf
        const [existing] = await ctx.db
          .select()
          .from(shelfItems)
          .where(
            and(
              eq(shelfItems.materialId, input.materialId),
              eq(shelfItems.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (existing) {
          return existing;
        }

        // 3. Insert shelf item
        const [shelfItem] = await ctx.db
          .insert(shelfItems)
          .values({
            materialId: input.materialId,
            userId: ctx.user.id,
          })
          .returning();

        if (!shelfItem) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to place material on your desk.',
          });
        }

        return shelfItem;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in createShelfItem:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        });
      }
    }),

  getShelfItems: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const items = await ctx.db
          .select({
            id: shelfItems.id,
            materialId: shelfItems.materialId,
            userId: shelfItems.userId,
            createdAt: shelfItems.createdAt,
            material: materials,
          })
          .from(shelfItems)
          .innerJoin(materials, eq(shelfItems.materialId, materials.id))
          .where(eq(shelfItems.userId, ctx.user.id))
          .orderBy(desc(shelfItems.createdAt));

        return items;
      } catch (error) {
        console.error("Error in getShelfItems:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve items from your desk.',
        });
      }
    }),

  deleteShelfItem: protectedProcedure
    .input(deleteShelfItemSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [deleted] = await ctx.db
          .delete(shelfItems)
          .where(
            and(
              eq(shelfItems.id, input.id),
              eq(shelfItems.userId, ctx.user.id)
            )
          )
          .returning();

        if (!deleted) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Item not found on your desk.',
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in deleteShelfItem:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete item from your desk.',
        });
      }
    }),

  moveToLibrary: protectedProcedure
    .input(moveToLibrarySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Fetch shelf item and verify ownership
        const [shelfItem] = await ctx.db
          .select()
          .from(shelfItems)
          .where(
            and(
              eq(shelfItems.id, input.shelfItemId),
              eq(shelfItems.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!shelfItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Item not found on your desk.',
          });
        }

        // 2. Perform move in a transaction
        await ctx.db.transaction(async (tx) => {
          // A. Delete shelf item
          await tx
            .delete(shelfItems)
            .where(eq(shelfItems.id, input.shelfItemId));

          // B. Check if library entry already exists for this material/user
          const [existingLib] = await tx
            .select()
            .from(libraryMaterials)
            .where(
              and(
                eq(libraryMaterials.materialId, shelfItem.materialId),
                eq(libraryMaterials.userId, ctx.user.id)
              )
            )
            .limit(1);

          // C. If not in library, add it
          if (!existingLib) {
            await tx.insert(libraryMaterials).values({
              materialId: shelfItem.materialId,
              userId: ctx.user.id,
              starred: false,
            });
          }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in moveToLibrary:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to move item to your library.',
        });
      }
    }),
});
