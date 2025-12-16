import { createServerFn } from "@tanstack/react-start";
import { authenticationMiddleware } from "@/middleware/auth";
import { slugify } from "@/lib/slugify";
import prisma from "@/lib/db";
import { getRandomHslColor } from "@/helpers/color-validator";
import {
  createCollectionSchema,
  moveItemsToCollectionSchema,
  removeCollectionSchema,
  updateCollectionSchema,
} from "@/validations/collection.schema";

const MAX_COLLECTIONS_PER_USER = 100;

export const createCollection = createServerFn({ method: "POST" })
  .inputValidator(createCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { name } = data;

    const userId = context.user.id;

    const userCollectionCount = await prisma.collection.count({
      where: { userId, deletedAt: null },
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
        color: getRandomHslColor(),
        isDefault: false,
      },
    });

    return collection;
  });

export const updateCollection = createServerFn()
  .inputValidator(updateCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { id, name } = data;

    const userId = context.user.id;

    const existing = await prisma.collection.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existing) {
      throw new Error("Collection not found or unauthorized");
    }

    if (existing.isDefault && name !== undefined) {
      throw new Error("Cannot rename default collection");
    }

    const updateData: Record<string, unknown> = {};

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
  .inputValidator(removeCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { id } = data;
    const userId = context.user.id;

    const collection = await prisma.collection.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!collection) {
      throw new Error("Collection not found or unauthorized");
    }

    if (collection.isDefault) {
      throw new Error("Cannot delete default collection");
    }

    await prisma.$transaction(async (tx) => {
      const defaultCollection = await tx.collection.findFirst({
        where: { userId, isDefault: true, deletedAt: null },
      });

      if (!defaultCollection) {
        throw new Error("Default collection not found");
      }

      await tx.item.updateMany({
        where: { collectionId: id, userId },
        data: {
          collectionId: defaultCollection.id,
          updatedAt: new Date(),
        },
      });

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
  .inputValidator(moveItemsToCollectionSchema)
  .middleware([authenticationMiddleware])
  .handler(async ({ data, context }) => {
    if (!context.user) {
      throw new Error("Unauthorized");
    }

    const { itemIds, targetCollectionId } = data;
    const userId = context.user.id;

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
  const base = slugify(name);
  const escaped = escapeRegex(base);

  const existing = await prisma.collection.findMany({
    where: {
      userId,
      deletedAt: null,
      slug: {
        startsWith: base,
      },
    },
    select: { slug: true },
  });

  if (existing.length === 0) {
    return base;
  }

  const regex = new RegExp(`^${escaped}-(\\d+)$`);

  const numbers = existing
    .map((e) => {
      const match = e.slug.match(regex);
      return match ? Number(match[1]) : null;
    })
    .filter((n): n is number => n !== null);

  if (numbers.length === 0) {
    return `${base}-1`;
  }

  const next = Math.max(...numbers) + 1;
  return `${base}-${next}`;
}
