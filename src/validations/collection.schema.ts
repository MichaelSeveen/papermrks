import { z } from "zod/v4";

export const collectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
});

const moveItemsToCollectionSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(1000),
  targetCollectionId: z.string(),
});

const updateCollectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
});

const removeCollectionSchema = z.object({
  id: z.string(),
});

export {
  createCollectionSchema,
  moveItemsToCollectionSchema,
  updateCollectionSchema,
  removeCollectionSchema,
};

export type CollectionDataType = z.infer<typeof collectionSchema>;
