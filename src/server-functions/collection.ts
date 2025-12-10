import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticationMiddleware } from "@/middleware/auth";
import { slugifyTag } from "@/lib/ai";
import prisma from "@/lib/db";
import { validateColor } from "@/helpers/color-validator";

const MAX_COLLECTIONS_PER_USER = 100;

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string(),
});

const MoveItemsToCollectionSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(1000),
  targetCollectionId: z.string(),
});

const UpdateCollectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  color: z.string(),
});

const DeleteCollectionSchema = z.object({
  id: z.string(),
});

export const createCollection = createServerFn({ method: "POST" })
  .inputValidator(CreateCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { name, color } = data;

    const isValidColor = validateColor(color);

    const userId = context.user.id;

    // Check collection limit
    const userCollectionCount = await prisma.collection.count({
      where: { userId, deletedAt: null }, // Only count active collections
    });

    if (userCollectionCount >= MAX_COLLECTIONS_PER_USER) {
      throw new Error(
        `Maximum of ${MAX_COLLECTIONS_PER_USER} collections allowed`
      );
    }

    const slug = await generateUniqueSlug(userId, name);

    const collection = await prisma.collection.create({
      data: {
        userId,
        name,
        slug,
        color: isValidColor ? color : "#F2542C",
        isDefault: false,
      },
    });

    return collection;
  });

export const updateCollection = createServerFn()
  .inputValidator(UpdateCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { id, name, color } = data;

    const isValidColor = validateColor(color);

    const userId = context.user.id;

    // Verify user owns collection
    const existing = await prisma.collection.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existing) {
      throw new Error("Collection not found or unauthorized");
    }

    // Can't update default collection name
    if (existing.isDefault && name !== undefined) {
      throw new Error("Cannot rename default collection");
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (color !== undefined) {
      updateData.color = isValidColor ? color : "#F2542C";
    }

    if (name !== undefined && name !== existing.name) {
      const slug = generateUniqueSlug(userId, name);
      updateData.name = name;
      updateData.slug = slug;
    }

    const updated = await prisma.collection.update({
      where: { id },
      data: updateData,
    });

    return updated;
  });

export const deleteCollection = createServerFn()
  .inputValidator(DeleteCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { id } = data;
    const userId = context.user.id;

    // Verify user owns collection
    const collection = await prisma.collection.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!collection) {
      throw new Error("Collection not found or unauthorized");
    }

    // Can't delete default collection
    if (collection.isDefault) {
      throw new Error("Cannot delete default collection");
    }

    await prisma.$transaction(async (tx) => {
      // Find default collection
      const defaultCollection = await tx.collection.findFirst({
        where: { userId, isDefault: true, deletedAt: null },
      });

      if (!defaultCollection) {
        throw new Error("Default collection not found");
      }

      // Move all items from deleted collection to default
      await tx.item.updateMany({
        where: { collectionId: id, userId },
        data: {
          collectionId: defaultCollection.id,
          updatedAt: new Date(),
        },
      });

      // Soft delete collection
      await tx.collection.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    return { success: true };
  });

export const getCollections = createServerFn({ method: "GET" })
  .middleware([authenticationMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    return await prisma.collection.findMany({
      where: {
        userId: context.user.id,
        deletedAt: null,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  });

export const moveItemsToCollection = createServerFn({ method: "POST" })
  .inputValidator(MoveItemsToCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { itemIds, targetCollectionId } = data;
    const userId = context.user.id;

    // Verify target collection belongs to user
    const targetCollection = await prisma.collection.findFirst({
      where: {
        id: targetCollectionId,
        userId,
        deletedAt: null,
      },
    });

    if (!targetCollection) {
      throw new Error("Target collection not found or unauthorized");
    }

    // Move items (only items belonging to user)
    const result = await prisma.item.updateMany({
      where: {
        id: { in: itemIds },
        userId,
      },
      data: {
        collectionId: targetCollectionId,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      movedCount: result.count,
    };
  });

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generates a unique slug for a collection name.
 * Fetches all matching slugs in a single query for optimal performance.
 * Uses numbered suffixes (e.g., "work-1", "work-2") for duplicates.
 */
async function generateUniqueSlug(
  userId: string,
  name: string
): Promise<string> {
  const base = slugifyTag(name);
  const escaped = escapeRegex(base);

  // Fetch all slugs starting with the base
  const existing = await prisma.collection.findMany({
    where: {
      userId,
      deletedAt: null, // Only consider active collections
      slug: {
        startsWith: base, // "name", "name-1", "name-2", etc.
      },
    },
    select: { slug: true },
  });

  if (existing.length === 0) {
    return base;
  }

  // Build a regex to capture only `base-<number>`
  const regex = new RegExp(`^${escaped}-(\\d+)$`);

  const numbers = existing
    .map((e) => {
      const match = e.slug.match(regex);
      return match ? Number(match[1]) : null;
    })
    .filter((n): n is number => n !== null);

  if (numbers.length === 0) {
    // base exists but no numbered duplicates → use base-1
    return `${base}-1`;
  }

  const next = Math.max(...numbers) + 1;
  return `${base}-${next}`;
}
