import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { materials, libraryMaterials, hiveMaterialShares, hiveMembers, storageObjects } from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const getLibraryMaterialsSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().nullish(), // ISO timestamp of addedAt
  search: z.string().optional(),
  starredOnly: z.boolean().optional(),
  contentType: z.enum(['text', 'link', 'youtube', 'file', 'image']).optional(),
  sortBy: z.enum(['addedAt', 'title']).default('addedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const libraryActionSchema = z.object({
  materialId: z.string().uuid("Invalid material ID format"),
});

export const libraryRouter = createTRPCRouter({
  getLibraryMaterials: protectedProcedure
    .input(getLibraryMaterialsSchema)
    .query(async ({ ctx, input }) => {
      try {
        let whereClause = eq(libraryMaterials.userId, ctx.user.id);
        
        if (input.starredOnly) {
          whereClause = and(whereClause, eq(libraryMaterials.starred, true)) as any;
        }

        if (input.contentType) {
          whereClause = and(whereClause, eq(materials.contentType, input.contentType)) as any;
        }

        if (input.search) {
          whereClause = and(
            whereClause,
            sql`${materials.searchVec} @@ plainto_tsquery('english', ${input.search})`
          ) as any;
        }

        if (input.cursor) {
          const cursorDate = new Date(input.cursor);
          if (input.sortBy === 'addedAt') {
            if (input.sortOrder === 'desc') {
              whereClause = and(whereClause, sql`${libraryMaterials.addedAt} < ${cursorDate}`) as any;
            } else {
              whereClause = and(whereClause, sql`${libraryMaterials.addedAt} > ${cursorDate}`) as any;
            }
          }
        }

        const orderByClause = input.sortBy === 'title'
          ? (input.sortOrder === 'desc' ? desc(materials.title) : asc(materials.title))
          : (input.sortOrder === 'desc' ? desc(libraryMaterials.addedAt) : asc(libraryMaterials.addedAt));

        const items = await ctx.db
          .select({
            id: libraryMaterials.id,
            starred: libraryMaterials.starred,
            addedAt: libraryMaterials.addedAt,
            material: materials,
          })
          .from(libraryMaterials)
          .innerJoin(materials, eq(libraryMaterials.materialId, materials.id))
          .where(whereClause)
          .orderBy(orderByClause)
          .limit(input.limit + 1);

        let nextCursor: string | undefined = undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.addedAt.toISOString();
        }

        return {
          items,
          nextCursor,
        };
      } catch (error) {
        console.error("Error in getLibraryMaterials:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve library materials.',
        });
      }
    }),

  addToLibrary: protectedProcedure
    .input(libraryActionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const materialId = await resolveOrCreatePersonalMaterial(ctx, input.materialId, false);
        return { success: true, materialId };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in addToLibrary:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add material to library.',
        });
      }
    }),

  starMaterial: protectedProcedure
    .input(libraryActionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const materialId = await resolveOrCreatePersonalMaterial(ctx, input.materialId, true);
        return { success: true, materialId };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in starMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to star material.',
        });
      }
    }),

  unstarMaterial: protectedProcedure
    .input(libraryActionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(libraryMaterials)
          .set({ starred: false })
          .where(
            and(
              eq(libraryMaterials.materialId, input.materialId),
              eq(libraryMaterials.userId, ctx.user.id)
            )
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Material is not in your library.',
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in unstarMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to unstar material.',
        });
      }
    }),

  getHiveMaterialsForLibrary: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Fetch materials shared to hives where user is member, 
        // excluding materials already owned by user
        const list = await ctx.db
          .select({
            shareId: hiveMaterialShares.id,
            hiveId: hiveMaterialShares.hiveId,
            sharedAt: hiveMaterialShares.sharedAt,
            material: materials,
          })
          .from(hiveMaterialShares)
          .innerJoin(hiveMembers, eq(hiveMaterialShares.hiveId, hiveMembers.hiveId))
          .innerJoin(materials, eq(hiveMaterialShares.materialId, materials.id))
          .where(
            and(
              eq(hiveMembers.userId, ctx.user.id),
              sql`${materials.ownerId} != ${ctx.user.id}`
            )
          )
          .orderBy(desc(hiveMaterialShares.sharedAt));

        return list;
      } catch (error) {
        console.error("Error in getHiveMaterialsForLibrary:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve hive materials.',
        });
      }
    }),
});

/**
 * Helper function to check ownership of a material. 
 * If owned by current user, upserts into library_materials.
 * If owned by someone else, verifies user has hive access to it, 
 * makes a copy of the material inside a transaction, and inserts library entry.
 */
async function resolveOrCreatePersonalMaterial(
  ctx: { db: any; user: { id: string } },
  materialId: string,
  starredValue: boolean
): Promise<string> {
  const [material] = await ctx.db
    .select()
    .from(materials)
    .where(eq(materials.id, materialId))
    .limit(1);

  if (!material) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Material not found.',
    });
  }

  // Case 1: User owns the material
  if (material.ownerId === ctx.user.id) {
    const [existing] = await ctx.db
      .select()
      .from(libraryMaterials)
      .where(
        and(
          eq(libraryMaterials.materialId, materialId),
          eq(libraryMaterials.userId, ctx.user.id)
        )
      )
      .limit(1);

    if (existing) {
      await ctx.db
        .update(libraryMaterials)
        .set({ starred: starredValue })
        .where(eq(libraryMaterials.id, existing.id));
    } else {
      await ctx.db
        .insert(libraryMaterials)
        .values({
          materialId,
          userId: ctx.user.id,
          starred: starredValue,
        });
    }
    return materialId;
  }

  // Case 2: Shared material owned by another user (Hive copy flow)
  // Verify access via hive memberships
  const [shareCheck] = await ctx.db
    .select({ hiveId: hiveMaterialShares.hiveId })
    .from(hiveMaterialShares)
    .innerJoin(hiveMembers, eq(hiveMaterialShares.hiveId, hiveMembers.hiveId))
    .where(
      and(
        eq(hiveMaterialShares.materialId, materialId),
        eq(hiveMembers.userId, ctx.user.id)
      )
    )
    .limit(1);

  if (!shareCheck) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to add this material to your library.',
    });
  }

  // Run the copy flow inside transaction
  const copyResult = await ctx.db.transaction(async (tx: any) => {
    // A. Check if the user already has a library copy of this specific original material
    // to prevent duplicate copying.
    const [existingCopy] = await tx
      .select({ id: materials.id })
      .from(materials)
      .innerJoin(libraryMaterials, eq(materials.id, libraryMaterials.materialId))
      .where(
        and(
          eq(materials.ownerId, ctx.user.id),
          eq(materials.storageRefId, material.storageRefId ?? 'none'),
          eq(materials.url, material.url ?? 'none'),
          eq(materials.body, material.body ?? 'none')
        )
      )
      .limit(1);

    if (existingCopy) {
      // Just update star value
      await tx
        .update(libraryMaterials)
        .set({ starred: starredValue })
        .where(eq(libraryMaterials.materialId, existingCopy.id));
      return existingCopy.id as string;
    }

    // B. If file: increment refCount
    if (material.storageRefId) {
      await tx
        .update(storageObjects)
        .set({ refCount: sql`${storageObjects.refCount} + 1` })
        .where(eq(storageObjects.refId, material.storageRefId));
    }

    // C. Create new materials row (copied)
    const [copiedMat] = await tx
      .insert(materials)
      .values({
        ownerId: ctx.user.id,
        contentType: material.contentType,
        title: material.title ? `${material.title} (Copy)` : null,
        body: material.body,
        url: material.url,
        ogTitle: material.ogTitle,
        ogDescription: material.ogDescription,
        ogImage: material.ogImage,
        ogDomain: material.ogDomain,
        storagePath: material.storagePath,
        storageRefId: material.storageRefId,
        fileName: material.fileName,
        fileSize: material.fileSize,
        mimeType: material.mimeType,
        tags: material.tags,
      })
      .returning();

    // D. Insert into library_materials
    await tx.insert(libraryMaterials).values({
      materialId: copiedMat.id,
      userId: ctx.user.id,
      starred: starredValue,
    });

    return copiedMat.id as string;
  });

  return copyResult;
}
