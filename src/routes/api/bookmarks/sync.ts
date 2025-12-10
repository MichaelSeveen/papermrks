import { SyncPayload, ServerResponse } from "@/helpers/db-sync";
import type { ItemType, LocalTag } from "@/lib/dexie";
import prisma from "@/lib/db";
import { authenticationMiddleware } from "@/middleware/auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/bookmarks/sync")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: {
          middleware: [authenticationMiddleware],
          handler: async ({ request, context }) => {
            if (!context.user) {
              return new Response("Unauthorized", { status: 401 });
            }
            try {
              const url = new URL(request.url);
              const since = parseInt(url.searchParams.get("since") || "0", 10);
              const sinceDate = new Date(since);
              const userId = context.user.id;

              // Fetch all changes since timestamp
              const [items, collections, tags] = await Promise.all([
                prisma.item.findMany({
                  where: {
                    userId,
                    updatedAt: { gt: sinceDate },
                  },
                  include: {
                    tags: {
                      include: {
                        tag: true,
                      },
                    },
                  },
                }),
                prisma.collection.findMany({
                  where: {
                    userId,
                    updatedAt: { gt: sinceDate },
                  },
                }),
                prisma.tag.findMany({
                  where: {
                    userId,
                    createdAt: { gt: sinceDate },
                  },
                }),
              ]);

              // Transform to local format
              const payload: SyncPayload = {
                items: items.map((item) => ({
                  id: item.id,
                  userId: item.userId,
                  collectionId: item.collectionId,
                  type: item.type as ItemType,
                  title: item.title,
                  rawInput: item.rawInput,
                  url: item.url || undefined,
                  normalizedUrl: item.normalizedUrl || undefined,
                  description: item.description || undefined,
                  summary: item.summary || undefined,
                  favicon: item.favicon || undefined,
                  colorValue: item.colorValue || undefined,
                  isRead: item.isRead,
                  isFavorite: item.isFavorite,
                  syncStatus: "synced" as const,
                  lastSyncedAt: Date.now(),
                  createdAt: item.createdAt.getTime(),
                  updatedAt: item.updatedAt.getTime(),
                })),
                collections: collections.map((col) => ({
                  id: col.id,
                  userId: col.userId,
                  name: col.name,
                  slug: col.slug,
                  color: col.color || undefined,
                  isDefault: col.isDefault,
                  syncStatus: "synced" as const,
                  createdAt: col.createdAt.getTime(),
                  updatedAt: col.updatedAt.getTime(),
                })),
                tags: tags.map((tag) => ({
                  id: tag.id,
                  userId: tag.userId,
                  name: tag.name,
                  slug: tag.slug,
                  syncStatus: "synced" as const,
                  lastSyncedAt: Date.now(),
                  updatedAt: tag.updatedAt.getTime(),
                  createdAt: tag.createdAt.getTime(),
                })),
                itemTags: items.flatMap((item) =>
                  item.tags.map((it) => ({
                    itemId: item.id,
                    tagId: it.tagId,
                    syncStatus: "synced" as const,
                  }))
                ),
                deletions: {
                  itemIds: [],
                  collectionIds: [],
                  tagIds: [],
                },
              };

              return Response.json(payload);
            } catch (error) {
              console.error("Error fetching changes:", error);
              return new Response("Failed to fetch changes", { status: 500 });
            }
          },
        },
        POST: {
          middleware: [authenticationMiddleware],
          handler: async ({ request, context }) => {
            if (!context.user) {
              return new Response("Unauthorized", { status: 401 });
            }
            try {
              const payload: SyncPayload = await request.json();

              // Validate payload structure
              if (!payload || typeof payload !== "object") {
                return new Response("Invalid payload", { status: 400 });
              }

              // Ensure deletions object exists with defaults
              if (!payload.deletions) {
                payload.deletions = {
                  itemIds: [],
                  collectionIds: [],
                  tagIds: [],
                };
              }

              const userId = context.user.id;

              // Execute all operations in a transaction
              const uniqueTags = await prisma.$transaction(async (tx) => {
                // 1. Handle deletions first to avoid foreign key constraint violations
                if (payload.deletions) {
                  await Promise.all([
                    payload.deletions.itemIds.length > 0
                      ? tx.item.deleteMany({
                          where: {
                            id: { in: payload.deletions.itemIds },
                            userId,
                          },
                        })
                      : Promise.resolve(),
                    payload.deletions.collectionIds.length > 0
                      ? tx.collection.deleteMany({
                          where: {
                            id: { in: payload.deletions.collectionIds },
                            userId,
                          },
                        })
                      : Promise.resolve(),
                    payload.deletions.tagIds.length > 0
                      ? tx.tag.deleteMany({
                          where: {
                            id: { in: payload.deletions.tagIds },
                            userId,
                          },
                        })
                      : Promise.resolve(),
                  ]);
                }

                // 2. Sync collections and build local-to-cloud ID mapping
                const collectionIdMap = new Map<string, string>();

                if (payload.collections.length > 0) {
                  const upsertedCollections = await Promise.all(
                    payload.collections.map((col) =>
                      tx.collection.upsert({
                        where: {
                          userId_slug: {
                            userId,
                            slug: col.slug,
                          },
                        },
                        create: {
                          id: col.id,
                          userId,
                          name: col.name,
                          slug: col.slug,
                          color: col.color,
                          isDefault: col.isDefault,
                          createdAt: new Date(col.createdAt),
                          updatedAt: new Date(col.updatedAt),
                        },
                        update: {
                          name: col.name,
                          color: col.color,
                          updatedAt: new Date(col.updatedAt),
                        },
                      })
                    )
                  );

                  // Build mapping from local ID to cloud ID
                  for (let i = 0; i < payload.collections.length; i++) {
                    const localId = payload.collections[i].id;
                    const cloudId = upsertedCollections[i].id;
                    collectionIdMap.set(localId, cloudId);
                  }
                }

                // 3. Sync tags (batch upsert to avoid duplicate slugs)
                let uniqueTags: LocalTag[] = [];
                if (payload.tags.length > 0) {
                  uniqueTags = deduplicateTags(payload.tags);

                  await Promise.all(
                    uniqueTags.map((tag) =>
                      tx.tag.upsert({
                        where: {
                          userId_slug: {
                            userId,
                            slug: tag.slug,
                          },
                        },
                        create: {
                          id: tag.id,
                          userId,
                          name: tag.name,
                          slug: tag.slug,
                          createdAt: new Date(tag.createdAt),
                          updatedAt: new Date(tag.updatedAt),
                        },
                        update: {
                          name: tag.name,
                          updatedAt: new Date(tag.updatedAt),
                        },
                      })
                    )
                  );
                }

                // 4. Sync items (use mapped collection IDs)
                if (payload.items.length > 0) {
                  // Get or find valid collection IDs for items
                  const itemsWithValidCollections = await Promise.all(
                    payload.items.map(async (item) => {
                      // First try the mapping
                      let validCollectionId = collectionIdMap.get(
                        item.collectionId
                      );

                      if (!validCollectionId) {
                        // Collection wasn't in payload, check if it exists in cloud directly
                        const existingCollection =
                          await tx.collection.findFirst({
                            where: { id: item.collectionId, userId },
                          });

                        if (existingCollection) {
                          validCollectionId = existingCollection.id;
                        } else {
                          // Fallback to user's default collection
                          const defaultCollection =
                            await tx.collection.findFirst({
                              where: { userId, isDefault: true },
                            });

                          if (defaultCollection) {
                            validCollectionId = defaultCollection.id;
                          } else {
                            // Last resort: create a default collection
                            const newDefault = await tx.collection.create({
                              data: {
                                userId,
                                name: "Bookmarks",
                                slug: "bookmarks",
                                color: "#F2542C",
                                isDefault: true,
                              },
                            });
                            validCollectionId = newDefault.id;
                          }
                        }
                      }

                      return { ...item, collectionId: validCollectionId };
                    })
                  );

                  await Promise.all(
                    itemsWithValidCollections.map((item) =>
                      tx.item.upsert({
                        where: { id: item.id },
                        create: {
                          id: item.id,
                          userId,
                          collectionId: item.collectionId,
                          type: item.type,
                          title: item.title,
                          rawInput: item.rawInput,
                          url: item.url,
                          normalizedUrl: item.normalizedUrl,
                          description: item.description,
                          summary: item.summary,
                          favicon: item.favicon,
                          colorValue: item.colorValue,
                          isRead: item.isRead,
                          isFavorite: item.isFavorite,
                          createdAt: new Date(item.createdAt),
                          updatedAt: new Date(item.updatedAt),
                        },
                        update: {
                          collectionId: item.collectionId,
                          title: item.title,
                          description: item.description,
                          summary: item.summary,
                          favicon: item.favicon,
                          isRead: item.isRead,
                          isFavorite: item.isFavorite,
                          updatedAt: new Date(item.updatedAt),
                        },
                      })
                    )
                  );
                }

                // 5. Sync item-tag relationships (only for items in this payload)
                if (payload.itemTags.length > 0) {
                  // Get IDs of items that exist in this sync payload
                  const syncedItemIds = new Set(payload.items.map((i) => i.id));
                  const syncedTagIds = new Set(uniqueTags.map((t) => t.id));

                  // Filter itemTags to only include valid references
                  const validItemTags = payload.itemTags.filter(
                    (it) =>
                      syncedItemIds.has(it.itemId) && syncedTagIds.has(it.tagId)
                  );

                  if (validItemTags.length > 0) {
                    // Delete existing relationships for these items
                    const itemIds = [
                      ...new Set(validItemTags.map((it) => it.itemId)),
                    ];
                    await tx.itemTag.deleteMany({
                      where: {
                        itemId: { in: itemIds },
                      },
                    });

                    // Create new relationships (batch)
                    await tx.itemTag.createMany({
                      data: validItemTags.map((it) => ({
                        itemId: it.itemId,
                        tagId: it.tagId,
                      })),
                      skipDuplicates: true,
                    });
                  }
                }

                // Return uniqueTags for use in response
                return uniqueTags;
              });

              const response: ServerResponse = {
                success: true,
                synced: {
                  items: payload.items.map((i) => i.id),
                  collections: payload.collections.map((c) => c.id),
                  tags: uniqueTags.map((t) => t.id),
                  itemTags: payload.itemTags.map((it) => ({
                    itemId: it.itemId,
                    tagId: it.tagId,
                  })),
                },
                deleted: {
                  items: payload.deletions.itemIds,
                  collections: payload.deletions.collectionIds,
                  tags: payload.deletions.tagIds,
                },
              };

              return Response.json(response);
            } catch (error) {
              console.error("Sync error:", error);
              return new Response(
                JSON.stringify({
                  error: "Sync failed",
                  details:
                    error instanceof Error ? error.message : "Unknown error",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              );
            }
          },
        },
      }),
  },
});

/**
 * Helper to deduplicate tags by slug.
 * Picks first occurrence of each unique slug, preserving all properties.
 * Generic type parameter ensures all tag properties are maintained
 */
function deduplicateTags<T extends { slug: string }>(tags: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const tag of tags) {
    if (!seen.has(tag.slug)) {
      seen.add(tag.slug);
      unique.push(tag);
    }
  }

  return unique;
}
