import { useCallback, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureDefaultCollection, getDB, type LocalItem } from "@/lib/dexie";
import {
  getFaviconURL,
  validateAndNormalizeURL,
} from "@/helpers/url-validator";
import { formatColor, isValidColor } from "@/helpers/color-validator";
import { slugifyTag } from "@/lib/ai";
import type { ParsedItem } from "@/helpers/input-parser";

export function useBookmarks(
  userId: string | undefined,
  collectionId?: string
) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Load bookmarks from IndexedDB (reactive)
  const items = useLiveQuery(async () => {
    if (!userId) return [];

    const db = getDB(userId);

    if (collectionId) {
      return await db.items
        .where("collectionId")
        .equals(collectionId)
        .filter((item) => !item.isDeleted)
        .reverse()
        .sortBy("createdAt");
    }

    return await db.items
      .filter((item) => !item.isDeleted)
      .reverse()
      .sortBy("createdAt");
  }, [userId, collectionId]);

  /**
   * Adds a bookmark/color/text with optimistic pipeline
   * Saves to IndexedDB immediately, enriches via API in background
   */
  const addItem = useCallback(
    async (rawInput: string, manualTags: string[] = []) => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      setIsProcessing(true);

      try {
        const db = getDB(userId);

        // Ensure default collection exists
        const defaultCollection = await ensureDefaultCollection(db, userId);

        // Classify input type (locally, no API needed)
        const urlValidation = validateAndNormalizeURL(rawInput);
        const isColor = isValidColor(rawInput);

        console.log("urlValidation", urlValidation);
        console.log("isColor", isColor);

        let itemType: "BOOKMARK" | "COLOR" | "TEXT";
        let normalizedUrl: string | undefined;
        let colorValue: string | undefined;

        if (urlValidation.isValid) {
          itemType = "BOOKMARK";
          normalizedUrl = urlValidation.normalizedUrl;
        } else if (isColor) {
          itemType = "COLOR";
          colorValue = formatColor(rawInput);
        } else {
          itemType = "TEXT";
        }

        // Create item in IndexedDB immediately (offline-first)
        const itemId = crypto.randomUUID();
        const optimisticItem: LocalItem = {
          id: itemId,
          userId,
          collectionId: collectionId || defaultCollection.id,
          type: itemType,
          title: itemType === "BOOKMARK" ? "Loading..." : rawInput,
          rawInput,
          normalizedUrl,
          colorValue,
          isRead: false,
          isFavorite: false,
          syncStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Save to IndexedDB
        await db.items.add(optimisticItem);

        // Process bookmarks via API in background (non-blocking)
        if (itemType === "BOOKMARK" && normalizedUrl) {
          processBookmarkViaAPI(
            db,
            userId,
            itemId,
            normalizedUrl,
            manualTags
          ).catch((error) => {
            console.error("Background processing failed:", error);
            // Item is still saved, just without enrichment
          });
        } else if (itemType === "COLOR" || itemType === "TEXT") {
          // For non-bookmarks, just add manual tags if any
          if (manualTags.length > 0) {
            await addTagsToItem(db, userId, itemId, manualTags);
          }

          // Mark as ready to sync
          await db.items.update(itemId, {
            syncStatus: "pending",
            updatedAt: Date.now(),
          });
        }

        return { success: true, itemId };
      } catch (error) {
        console.error("Add item error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to add item",
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [userId, collectionId]
  );

  /**
   * Handles multi-item paste (URLs, colors, text)
   */
  const addMultipleItems = useCallback(
    async (items: ParsedItem[]) => {
      if (!userId) return { success: false, error: "Not authenticated" };

      if (items.length === 0) {
        return { success: false, error: "No items provided" };
      }

      // Add all items concurrently using rawValue (addItem handles classification)
      const results = await Promise.allSettled(
        items.map((item) => addItem(item.rawValue))
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;

      return {
        success: true,
        addedCount: successful,
        totalCount: items.length,
      };
    },
    [userId, addItem]
  );

  /**
   * Deletes items (bulk soft delete)
   */
  const deleteItems = useCallback(
    async (itemIds: string[]) => {
      if (!userId) return { success: false };

      try {
        const db = getDB(userId);

        // Soft delete: mark as pending sync and deleted
        await Promise.all(
          itemIds.map((id) =>
            db.items.update(id, {
              isDeleted: true,
              deletedAt: Date.now(),
              syncStatus: "pending",
              updatedAt: Date.now(),
            })
          )
        );

        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [userId]
  );

  /**
   * Bulk tag operation
   */
  const bulkTag = useCallback(
    async (itemIds: string[], tagNames: string[]) => {
      if (!userId) return { success: false };

      try {
        const db = getDB(userId);

        // Process each item
        await Promise.all(
          itemIds.map((itemId) => addTagsToItem(db, userId, itemId, tagNames))
        );

        // Mark items as pending sync
        await Promise.all(
          itemIds.map((id) =>
            db.items.update(id, {
              syncStatus: "pending",
              updatedAt: Date.now(),
            })
          )
        );

        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [userId]
  );

  /**
   * Re-fetches metadata for a bookmark
   */
  const refetchMetadata = useCallback(
    async (itemId: string) => {
      if (!userId) return { success: false };

      try {
        const db = getDB(userId);
        const item = await db.items.get(itemId);

        if (!item || !item.normalizedUrl) {
          return {
            success: false,
            error: "Item not found or not a bookmark",
          };
        }

        await processBookmarkViaAPI(db, userId, itemId, item.normalizedUrl, []);

        return { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    [userId]
  );

  return {
    items: items || [],
    isProcessing,
    addItem,
    addMultipleItems,
    deleteItems,
    bulkTag,
    refetchMetadata,
  };
}

/**
 * Processes bookmark metadata and AI features via API routes
 * Runs in background, does not block main UI
 */
async function processBookmarkViaAPI(
  db: ReturnType<typeof getDB>,
  userId: string,
  itemId: string,
  normalizedUrl: string,
  manualTags: string[]
) {
  try {
    // Step 1: Fetch metadata via API
    const metadataResponse = await fetch("/api/bookmarks/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalizedUrl }),
      credentials: "include",
    });

    if (!metadataResponse.ok) {
      throw new Error("Metadata fetch failed");
    }

    const metadata = await metadataResponse.json();

    // Update item with metadata
    await db.items.update(itemId, {
      title: metadata.title || extractDomainAsTitle(normalizedUrl),
      description: metadata.description,
      summary: metadata.summary,
      favicon: getFaviconURL(normalizedUrl),
      updatedAt: Date.now(),
    });

    // Step 2: Generate AI tags via API
    const tagsResponse = await fetch("/api/bookmarks/ai-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: metadata.title || "",
        description: metadata.description || "",
        url: normalizedUrl,
        content: metadata.content,
      }),
      credentials: "include",
    });

    if (!tagsResponse.ok) {
      throw new Error("AI tags generation failed");
    }

    const { tags: aiTags } = await tagsResponse.json();

    // Combine manual and AI tags (deduplicate)
    const allTags = [...new Set([...manualTags, ...aiTags])];

    // Add tags to item
    if (allTags.length > 0) {
      await addTagsToItem(db, userId, itemId, allTags);
    }

    // Mark as ready to sync
    await db.items.update(itemId, {
      syncStatus: "pending",
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Background processing error:", error);

    // Fallback: at least set a basic title
    await db.items.update(itemId, {
      title: extractDomainAsTitle(normalizedUrl),
      description: normalizedUrl,
      favicon: getFaviconURL(normalizedUrl),
      updatedAt: Date.now(),
    });
  }
}

/**
 * Adds tags to an item (creates tags if needed)
 */
async function addTagsToItem(
  db: ReturnType<typeof getDB>,
  userId: string,
  itemId: string,
  tagNames: string[]
) {
  if (tagNames.length === 0) return;

  // Slugify and deduplicate
  const uniqueSlugs = [...new Set(tagNames.map(slugifyTag))];

  // Get or create tags
  const tagIds: string[] = [];

  for (const slug of uniqueSlugs) {
    const existingTag = await db.tags.where("slug").equals(slug).first();

    if (existingTag) {
      tagIds.push(existingTag.id);
    } else {
      // Create new tag
      const tagId = crypto.randomUUID();
      await db.tags.add({
        id: tagId,
        userId,
        name: slug,
        slug,
        syncStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      tagIds.push(tagId);
    }
  }

  // Remove existing item-tag relationships for this item
  await db.itemTags.where("itemId").equals(itemId).delete();

  // Add new relationships
  await db.itemTags.bulkAdd(
    tagIds.map((tagId) => ({
      itemId,
      tagId,
      syncStatus: "pending",
    }))
  );
}

/**
 * Extracts domain from URL as fallback title
 */
function extractDomainAsTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "Untitled";
  }
}
