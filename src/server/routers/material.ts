import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { materials, storageObjects, libraryMaterials, hiveMaterialShares, hiveMembers, youtubePlaylistVideos } from '@/db/schema';
import { fetchLinkMeta } from '../lib/fetchLinkMeta';
import { TRPCError } from '@trpc/server';
import { eq, sql, desc, and } from 'drizzle-orm';
import { parseVideoRange, fetchPlaylistVideos, fetchYoutubeVideoDurationWithoutKey, fetchYoutubeVideoDurationWithKey } from '@/lib/youtube';

export const createTextMaterialSchema = z.object({
  body: z.string().min(1, "Content cannot be empty").max(10000),
  tags: z.array(z.string()).default([]),
  title: z.string().optional(),
});

export const createLinkMaterialSchema = z.object({
  url: z.string().url("Invalid URL format").min(1, "URL is required"),
  tags: z.array(z.string()).default([]),
});

export const checkStorageObjectSchema = z.object({
  hash: z.string().min(1, "Hash is required"),
});

export const getPresignedUploadUrlSchema = z.object({
  hash: z.string().min(1, "Hash is required"),
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().min(1, "Mime type is required"),
});

export const confirmFileUploadSchema = z.object({
  hash: z.string().min(1, "Hash is required"),
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().min(1, "Mime type is required"),
  fileSize: z.number().int().nonnegative("File size must be a non-negative number"),
});

export const getMaterialsSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().nullish(), // ISO string of createdAt
});

export const updateMaterialSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
  title: z.string().min(1, "Title cannot be empty").optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ytVideoRange: z.string().optional(),
});

export const deleteMaterialSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
  removeFromHives: z.boolean().default(false),
});

export const copyMaterialSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export const materialRouter = createTRPCRouter({
  createTextMaterial: protectedProcedure
    .input(createTextMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const title = input.title ?? (input.body.split('\n')[0]?.slice(0, 50).trim() || "Untitled Note");

        const [material] = await ctx.db
          .insert(materials)
          .values({
            ownerId: ctx.user.id,
            contentType: 'text',
            title,
            body: input.body,
            tags: input.tags,
          })
          .returning();

        if (!material) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create text material.',
          });
        }

        return material;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in createTextMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the text material.',
        });
      }
    }),

  createLinkMaterial: protectedProcedure
    .input(createLinkMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const meta = await fetchLinkMeta(input.url);

        const isYoutube = meta.domain === 'youtube.com' || /youtube\.com|youtu\.be/i.test(input.url);
        const contentType = isYoutube ? 'youtube' : 'link';

        const title = meta.title || input.url;

        if (isYoutube) {
          // Parse YouTube Playlist and Video details
          const playlistIdMatch = input.url.match(/[&?]list=([^&]+)/i);
          const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;

          const videoIdMatch = input.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/||watch\?.*v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
          const videoId = videoIdMatch ? videoIdMatch[1] : null;

          if (playlistId) {
            const apiKey = process.env.YOUTUBE_API_KEY;
            if (!apiKey) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'YouTube API Key is not configured on the server. Cannot fetch playlist details.',
              });
            }

            const playlistVideos = await fetchPlaylistVideos(playlistId, apiKey);
            const totalDuration = playlistVideos.reduce((sum, v) => sum + v.duration, 0);

            const [material] = await ctx.db
              .insert(materials)
              .values({
                ownerId: ctx.user.id,
                contentType: 'youtube',
                url: input.url,
                title,
                ogTitle: meta.title,
                ogDescription: meta.description || 'YouTube Playlist',
                ogImage: meta.image,
                ogDomain: 'youtube.com',
                tags: input.tags,
                ytPlaylistId: playlistId,
                ytDuration: totalDuration,
                ytVideoRange: null,
              })
              .returning();

            if (!material) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to create playlist material.',
              });
            }

            if (playlistVideos.length > 0) {
              await ctx.db.insert(youtubePlaylistVideos).values(
                playlistVideos.map((v, index) => ({
                  materialId: material.id,
                  videoId: v.videoId,
                  title: v.title,
                  duration: v.duration,
                  position: index + 1,
                }))
              );
            }

            return material;
          } else if (videoId) {
            let duration = await fetchYoutubeVideoDurationWithoutKey(input.url);
            const apiKey = process.env.YOUTUBE_API_KEY;
            if (duration === null && apiKey) {
              duration = await fetchYoutubeVideoDurationWithKey(videoId, apiKey);
            }

            const [material] = await ctx.db
              .insert(materials)
              .values({
                ownerId: ctx.user.id,
                contentType: 'youtube',
                url: input.url,
                title,
                ogTitle: meta.title,
                ogDescription: meta.description,
                ogImage: meta.image,
                ogDomain: 'youtube.com',
                tags: input.tags,
                ytPlaylistId: null,
                ytDuration: duration || 0,
                ytVideoRange: null,
              })
              .returning();

            if (!material) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to create YouTube video material.',
              });
            }

            return material;
          }
        }

        // Standard link material creation fallback
        const [material] = await ctx.db
          .insert(materials)
          .values({
            ownerId: ctx.user.id,
            contentType,
            url: input.url,
            title,
            ogTitle: meta.title,
            ogDescription: meta.description,
            ogImage: meta.image,
            ogDomain: meta.domain,
            tags: input.tags,
          })
          .returning();

        if (!material) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create link material.',
          });
        }

        return material;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in createLinkMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while creating the link material.',
        });
      }
    }),

  checkStorageObject: protectedProcedure
    .input(checkStorageObjectSchema)
    .query(async ({ ctx, input }) => {
      try {
        const [obj] = await ctx.db
          .select()
          .from(storageObjects)
          .where(eq(storageObjects.refId, input.hash))
          .limit(1);

        if (obj) {
          return { exists: true, storagePath: obj.storagePath };
        }

        return { exists: false, storagePath: null };
      } catch (error) {
        console.error("Error in checkStorageObject:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check storage object existence.',
        });
      }
    }),

  getPresignedUploadUrl: protectedProcedure
    .input(getPresignedUploadUrlSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Check if it already exists in the database (dedup)
        const [existing] = await ctx.db
          .select()
          .from(storageObjects)
          .where(eq(storageObjects.refId, input.hash))
          .limit(1);

        if (existing) {
          return {
            exists: true,
            storagePath: existing.storagePath,
            signedUrl: null,
          };
        }

        // 2. Generate signed upload URL from Supabase Storage
        const storagePath = `materials/${input.hash}/${input.filename}`;
        
        const { data, error } = await ctx.supabase.storage
          .from('materials')
          .createSignedUploadUrl(storagePath, { upsert: true });

        if (error || !data) {
          console.error("Supabase Storage Error:", error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Storage provider failed to generate upload URL: ${error?.message || 'Unknown error'}`,
          });
        }

        return {
          exists: false,
          storagePath,
          signedUrl: data.signedUrl,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in getPresignedUploadUrl:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while generating the upload URL.',
        });
      }
    }),

  confirmFileUpload: protectedProcedure
    .input(confirmFileUploadSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          // 1. Check if the storage object exists
          const [existing] = await tx
            .select()
            .from(storageObjects)
            .where(eq(storageObjects.refId, input.hash))
            .limit(1);

          const storagePath = existing ? existing.storagePath : `materials/${input.hash}/${input.filename}`;

          if (existing) {
            // Increment refCount
            await tx
              .update(storageObjects)
              .set({ refCount: sql`${storageObjects.refCount} + 1` })
              .where(eq(storageObjects.refId, input.hash));
          } else {
            // Create storage object
            await tx.insert(storageObjects).values({
              refId: input.hash,
              storagePath,
              fileSize: input.fileSize,
              mimeType: input.mimeType,
              refCount: 1,
            });
          }

          // 2. Create the material
          const contentType = input.mimeType.startsWith('image/') ? 'image' : 'file';

          const [material] = await tx
            .insert(materials)
            .values({
              ownerId: ctx.user.id,
              contentType,
              title: input.filename,
              storagePath,
              storageRefId: input.hash,
              fileName: input.filename,
              fileSize: input.fileSize,
              mimeType: input.mimeType,
              tags: [],
            })
            .returning();

          return material;
        });

        if (!result) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to confirm file upload and create material.',
          });
        }

        return result;
      } catch (error) {
        console.error("Error in confirmFileUpload:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while confirming the file upload.',
        });
      }
    }),

  getMaterials: protectedProcedure
    .input(getMaterialsSchema)
    .query(async ({ ctx, input }) => {
      try {
        let whereClause = eq(materials.ownerId, ctx.user.id);
        if (input.cursor) {
          whereClause = and(whereClause, sql`${materials.createdAt} < ${new Date(input.cursor)}`) as any;
        }

        const items = await ctx.db
          .select()
          .from(materials)
          .where(whereClause)
          .orderBy(desc(materials.createdAt))
          .limit(input.limit + 1);

        let nextCursor: string | undefined = undefined;
        if (items.length > input.limit) {
          const nextItem = items.pop();
          nextCursor = nextItem?.createdAt.toISOString();
        }

        return {
          items,
          nextCursor,
        };
      } catch (error) {
        console.error("Error in getMaterials:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve materials.',
        });
      }
    }),

  updateMaterial: protectedProcedure
    .input(updateMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [material] = await ctx.db
          .select()
          .from(materials)
          .where(eq(materials.id, input.id))
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

        let finalDuration = material.ytDuration;
        let finalVideoRange = material.ytVideoRange;

        if (input.ytVideoRange !== undefined && material.contentType === 'youtube') {
          if (material.ytPlaylistId) {
            const videos = await ctx.db
              .select()
              .from(youtubePlaylistVideos)
              .where(eq(youtubePlaylistVideos.materialId, material.id))
              .orderBy(youtubePlaylistVideos.position);

            const allowedIndices = parseVideoRange(input.ytVideoRange, videos.length);
            const newDuration = videos
              .filter((v) => allowedIndices.has(v.position))
              .reduce((sum, v) => sum + v.duration, 0);

            finalDuration = newDuration;
            finalVideoRange = input.ytVideoRange.trim() === "" ? null : input.ytVideoRange;
          }
        }

        const [updated] = await ctx.db
          .update(materials)
          .set({
            title: input.title !== undefined ? input.title : material.title,
            body: input.body !== undefined ? input.body : material.body,
            tags: input.tags !== undefined ? input.tags : material.tags,
            ytVideoRange: finalVideoRange,
            ytDuration: finalDuration,
            updatedAt: new Date(),
          })
          .where(eq(materials.id, input.id))
          .returning();

        return updated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in updateMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update material.',
        });
      }
    }),

  deleteMaterial: protectedProcedure
    .input(deleteMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [material] = await ctx.db
          .select()
          .from(materials)
          .where(eq(materials.id, input.id))
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

        await ctx.db.transaction(async (tx) => {
          if (input.removeFromHives) {
            await tx
              .delete(hiveMaterialShares)
              .where(
                and(
                  eq(hiveMaterialShares.materialId, input.id),
                  eq(hiveMaterialShares.sharedBy, ctx.user.id)
                )
              );
          }

          await tx.delete(materials).where(eq(materials.id, input.id));
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in deleteMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete material.',
        });
      }
    }),

  getStarredMaterials: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const starred = await ctx.db
          .select({
            material: materials,
            starredAt: libraryMaterials.addedAt,
          })
          .from(libraryMaterials)
          .innerJoin(materials, eq(libraryMaterials.materialId, materials.id))
          .where(
            and(
              eq(libraryMaterials.userId, ctx.user.id),
              eq(libraryMaterials.starred, true)
            )
          )
          .orderBy(desc(libraryMaterials.addedAt));

        return starred.map(s => ({
          ...s.material,
          starredAt: s.starredAt,
        }));
      } catch (error) {
        console.error("Error in getStarredMaterials:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve starred materials.',
        });
      }
    }),

  copyMaterial: protectedProcedure
    .input(copyMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [origin] = await ctx.db
          .select()
          .from(materials)
          .where(eq(materials.id, input.id))
          .limit(1);

        if (!origin) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Original material not found.',
          });
        }

        const result = await ctx.db.transaction(async (tx) => {
          // 1. If it's a file with storageRefId, increment storage ref_count
          if (origin.storageRefId) {
            await tx
              .update(storageObjects)
              .set({ refCount: sql`${storageObjects.refCount} + 1` })
              .where(eq(storageObjects.refId, origin.storageRefId));
          }

          // 2. Create copied material
          const [copy] = await tx
            .insert(materials)
            .values({
              ownerId: ctx.user.id,
              contentType: origin.contentType,
              title: origin.title ? `${origin.title} (Copy)` : null,
              body: origin.body,
              url: origin.url,
              ogTitle: origin.ogTitle,
              ogDescription: origin.ogDescription,
              ogImage: origin.ogImage,
              ogDomain: origin.ogDomain,
              storagePath: origin.storagePath,
              storageRefId: origin.storageRefId,
              fileName: origin.fileName,
              fileSize: origin.fileSize,
              mimeType: origin.mimeType,
              tags: origin.tags,
            })
            .returning();

          if (!copy) throw new Error("Failed to insert material copy");

          // 3. Create library entry for the new copy
          await tx.insert(libraryMaterials).values({
            materialId: copy.id,
            userId: ctx.user.id,
            starred: false,
          });

          return copy;
        });

        return result;
      } catch (error) {
        console.error("Error in copyMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to copy material.',
        });
      }
    }),

  getLinkMetadata: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .query(async ({ input }) => {
      try {
        const meta = await fetchLinkMeta(input.url);
        return meta;
      } catch (error) {
        console.error("Error in getLinkMetadata:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch link metadata.',
        });
      }
    }),

  checkMaterialShares: protectedProcedure
    .input(z.object({ materialId: z.string().uuid("Invalid material ID") }))
    .query(async ({ ctx, input }) => {
      try {
        const shares = await ctx.db
          .select()
          .from(hiveMaterialShares)
          .where(eq(hiveMaterialShares.materialId, input.materialId));

        return {
          shared: shares.length > 0,
          count: shares.length,
        };
      } catch (error) {
        console.error("Error in checkMaterialShares:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify hive sharing status.',
        });
      }
    }),

  getMaterial: protectedProcedure
    .input(z.object({ id: z.string().uuid("Invalid ID format") }))
    .query(async ({ ctx, input }) => {
      try {
        const [material] = await ctx.db
          .select()
          .from(materials)
          .where(eq(materials.id, input.id))
          .limit(1);

        if (!material) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Material not found.',
          });
        }

        // 1. If user is owner, they have access
        let hasAccess = material.ownerId === ctx.user.id;

        // 2. If not owner, check if shared to any hive where user is member
        if (!hasAccess) {
          const [sharedCheck] = await ctx.db
            .select({ id: hiveMaterialShares.id })
            .from(hiveMaterialShares)
            .innerJoin(hiveMembers, eq(hiveMaterialShares.hiveId, hiveMembers.hiveId))
            .where(
              and(
                eq(hiveMaterialShares.materialId, input.id),
                eq(hiveMembers.userId, ctx.user.id)
              )
            )
            .limit(1);

          hasAccess = !!sharedCheck;
        }

        if (!hasAccess) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this material.',
          });
        }

        // Check if the material is in the user's library and if it is starred
        const [libraryEntry] = await ctx.db
          .select({
            id: libraryMaterials.id,
            starred: libraryMaterials.starred,
          })
          .from(libraryMaterials)
          .where(
            and(
              eq(libraryMaterials.materialId, input.id),
              eq(libraryMaterials.userId, ctx.user.id)
            )
          )
          .limit(1);

        return {
          ...material,
          inLibrary: !!libraryEntry,
          starred: libraryEntry ? libraryEntry.starred : false,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in getMaterial:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while fetching the material.',
        });
      }
    }),

  getPlaylistVideos: protectedProcedure
    .input(z.object({ materialId: z.string().uuid("Invalid material ID") }))
    .query(async ({ ctx, input }) => {
      try {
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

        // Check access
        let hasAccess = material.ownerId === ctx.user.id;
        if (!hasAccess) {
          const [sharedCheck] = await ctx.db
            .select({ id: hiveMaterialShares.id })
            .from(hiveMaterialShares)
            .innerJoin(hiveMembers, eq(hiveMaterialShares.hiveId, hiveMembers.hiveId))
            .where(
              and(
                eq(hiveMaterialShares.materialId, input.materialId),
                eq(hiveMembers.userId, ctx.user.id)
              )
            )
            .limit(1);

          hasAccess = !!sharedCheck;
        }

        if (!hasAccess) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this playlist.',
          });
        }

        const videos = await ctx.db
          .select()
          .from(youtubePlaylistVideos)
          .where(eq(youtubePlaylistVideos.materialId, input.materialId))
          .orderBy(youtubePlaylistVideos.position);

        return videos;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error in getPlaylistVideos:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve playlist videos.',
        });
      }
    }),
});
