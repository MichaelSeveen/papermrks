import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB, type LocalCollection } from "@/lib/dexie";
import { slugify } from "@/lib/slugify";
import { getRandomHslColor } from "@/helpers/color-validator";

const MAX_COLLECTIONS_PER_USER = 100;

/**
 * Escapes special regex characters in a string.
 * Required when using user-provided slugs in regex patterns.
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generates a unique slug for a collection name.
 * Uses numbered suffixes (e.g., "work-1", "work-2") for duplicates.
 */
async function generateLocalUniqueSlug(
  db: ReturnType<typeof getDB>,
  name: string
): Promise<string> {
  const base = slugify(name);
  const escaped = escapeRegex(base);

  // Find all slugs that start with the base slug
  const existing = await db.collections
    .filter((c) => !c.isDeleted && c.slug.startsWith(base))
    .toArray();

  const existingSlugs = existing.map((c) => c.slug);

  // If base slug doesn't exist, use it
  if (!existingSlugs.includes(base)) {
    return base;
  }

  // Find the next available number suffix
  const regex = new RegExp(`^${escaped}-(\\d+)$`);
  const numbers = existingSlugs
    .map((s) => {
      const match = s.match(regex);
      return match ? Number(match[1]) : null;
    })
    .filter((n): n is number => n !== null);

  if (numbers.length === 0) {
    return `${base}-1`;
  }

  const next = Math.max(...numbers) + 1;
  return `${base}-${next}`;
}

export interface UseCollectionsResult {
  collections: LocalCollection[];
  addCollection: (
    name: string
  ) => Promise<{ success: boolean; collectionId?: string; error?: string }>;
  updateCollection: (
    id: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteCollection: (
    id: string
  ) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Hook for managing collections with local-first pattern.
 * All operations write to IndexedDB first with syncStatus: "pending",
 * then get synced to server via SyncEngine.
 */
export function useCollections(
  userId: string | undefined
): UseCollectionsResult {
  // Reactive query - updates automatically when collections change
  const collections = useLiveQuery(
    async () => {
      if (!userId) return [];
      const db = getDB(userId);
      return await db.collections
        .filter((c) => !c.isDeleted)
        .sortBy("createdAt");
    },
    [userId],
    []
  );

  /**
   * Creates a new collection locally with pending sync status.
   * Generates a unique slug based on existing collections.
   */
  const addCollection = useCallback(
    async (
      name: string
    ): Promise<{ success: boolean; collectionId?: string; error?: string }> => {
      if (!userId) {
        return { success: false, error: "User not authenticated" };
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        return { success: false, error: "Name is required" };
      }

      if (trimmedName.length > 100) {
        return { success: false, error: "Name must be 100 characters or less" };
      }

      try {
        const db = getDB(userId);

        // Check collection limit
        const existingCount = await db.collections
          .filter((c) => !c.isDeleted)
          .count();

        if (existingCount >= MAX_COLLECTIONS_PER_USER) {
          return {
            success: false,
            error: `Maximum ${MAX_COLLECTIONS_PER_USER} collections allowed`,
          };
        }

        // Generate unique slug
        const slug = await generateLocalUniqueSlug(db, trimmedName);

        const collectionId = crypto.randomUUID();
        const now = Date.now();

        const newCollection: LocalCollection = {
          id: collectionId,
          userId,
          name: trimmedName,
          slug,
          color: getRandomHslColor(),
          isDefault: false,
          syncStatus: "pending",
          createdAt: now,
          updatedAt: now,
        };

        await db.collections.add(newCollection);

        return { success: true, collectionId };
      } catch (error) {
        console.error("Error adding collection:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to add collection",
        };
      }
    },
    [userId]
  );

  /**
   * Updates a collection's name (soft update with pending sync).
   */
  const updateCollection = useCallback(
    async (
      id: string,
      name: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!userId) {
        return { success: false, error: "User not authenticated" };
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        return { success: false, error: "Name is required" };
      }

      try {
        const db = getDB(userId);
        const existing = await db.collections.get(id);

        if (!existing || existing.isDeleted) {
          return { success: false, error: "Collection not found" };
        }

        if (existing.isDefault) {
          return { success: false, error: "Cannot rename default collection" };
        }

        // Generate new slug if name changed
        const newSlug = slugify(trimmedName);

        await db.collections.update(id, {
          name: trimmedName,
          slug: newSlug,
          syncStatus: "pending",
          updatedAt: Date.now(),
        });

        return { success: true };
      } catch (error) {
        console.error("Error updating collection:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update collection",
        };
      }
    },
    [userId]
  );

  /**
   * Soft-deletes a collection (marks as deleted with pending sync).
   * Items in this collection will be moved to default during server sync.
   */
  const deleteCollection = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) {
        return { success: false, error: "User not authenticated" };
      }

      try {
        const db = getDB(userId);
        const existing = await db.collections.get(id);

        if (!existing || existing.isDeleted) {
          return { success: false, error: "Collection not found" };
        }

        if (existing.isDefault) {
          return { success: false, error: "Cannot delete default collection" };
        }

        // Find default collection for item migration
        const defaultCollection = await db.collections
          .filter((c) => c.isDefault && !c.isDeleted)
          .first();

        if (!defaultCollection) {
          return { success: false, error: "Default collection not found" };
        }

        const now = Date.now();

        // Move items to default collection
        const itemsToMove = await db.items
          .where("collectionId")
          .equals(id)
          .filter((item) => !item.isDeleted)
          .toArray();

        await db.transaction("rw", [db.items, db.collections], async () => {
          // Update items
          for (const item of itemsToMove) {
            await db.items.update(item.id, {
              collectionId: defaultCollection.id,
              syncStatus: "pending",
              updatedAt: now,
            });
          }

          // Soft delete collection
          await db.collections.update(id, {
            isDeleted: true,
            deletedAt: now,
            syncStatus: "pending",
            updatedAt: now,
          });
        });

        return { success: true };
      } catch (error) {
        console.error("Error deleting collection:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete collection",
        };
      }
    },
    [userId]
  );

  return {
    collections: collections || [],
    addCollection,
    updateCollection,
    deleteCollection,
  };
}
