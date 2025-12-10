import Dexie, { type Table } from "dexie";

export type ItemType = "BOOKMARK" | "COLOR" | "TEXT";
export type SyncStatus = "pending" | "syncing" | "synced" | "error";

export interface LocalItem {
  id: string;
  userId: string;
  collectionId: string;
  type: ItemType;

  // Universal
  title: string;
  rawInput: string;

  // Bookmark-specific
  url?: string;
  normalizedUrl?: string;
  description?: string;
  summary?: string;
  favicon?: string;

  // Color-specific
  colorValue?: string;

  // Metadata
  isRead: boolean;
  isFavorite: boolean;

  // Sync tracking
  syncStatus: SyncStatus;
  lastSyncedAt?: number;
  syncError?: string;

  // Deletion tracking
  isDeleted?: boolean;
  deletedAt?: number;

  createdAt: number;
  updatedAt: number;
}

export interface LocalCollection {
  id: string;
  userId: string;
  name: string;
  slug: string;
  color?: string;
  isDefault: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt?: number;
  syncError?: string;
  isDeleted?: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LocalTag {
  id: string;
  userId: string;
  name: string;
  slug: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: number;
  syncError?: string;
  isDeleted?: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LocalItemTag {
  itemId: string;
  tagId: string;
  syncStatus: SyncStatus;
}

export interface SyncQueue {
  id: string;
  operation: "create" | "update" | "delete";
  entity: "item" | "collection" | "tag" | "itemTag";
  entityId: string;
  data: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  error?: string;
  createdAt: number;
}

class BookmarkDatabase extends Dexie {
  items!: Table<LocalItem, string>;
  collections!: Table<LocalCollection, string>;
  tags!: Table<LocalTag, string>;
  itemTags!: Table<LocalItemTag, [string, string]>;
  syncQueue!: Table<SyncQueue, string>;

  constructor(userId: string) {
    super(`BookmarkDB_${userId}`);

    // Version 2: Updated schema with syncStatus string
    this.version(2).stores({
      items:
        "id, collectionId, type, normalizedUrl, createdAt, updatedAt, syncStatus, lastSyncedAt, isDeleted, [syncStatus+isDeleted], [collectionId+createdAt]",
      collections:
        "id, slug, isDefault, updatedAt, syncStatus, lastSyncedAt, isDeleted, [syncStatus+isDeleted]",
      tags: "id, slug, updatedAt, syncStatus, lastSyncedAt, isDeleted, [syncStatus+isDeleted]",
      itemTags: "[itemId+tagId], itemId, tagId, syncStatus",
      syncQueue:
        "id, entity, createdAt, retryCount, nextRetryAt, [entity+nextRetryAt]",
    });
  }
}

// Singleton pattern - one DB instance per user
let dbInstance: BookmarkDatabase | null = null;
let currentUserId: string | null = null;

export function getDB(userId: string): BookmarkDatabase {
  if (!userId) {
    throw new Error("User ID required to access database");
  }

  if (dbInstance && currentUserId === userId) {
    return dbInstance;
  }

  // Close existing connection if switching users
  if (dbInstance) {
    dbInstance.close();
  }

  dbInstance = new BookmarkDatabase(userId);
  currentUserId = userId;

  return dbInstance;
}

export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    currentUserId = null;
  }
}

// Helper to create default collection for new users
export async function ensureDefaultCollection(
  db: BookmarkDatabase,
  userId: string
): Promise<LocalCollection> {
  const existing = await db.collections
    .filter((collection) => collection.isDefault)
    .first();

  if (existing) {
    return existing;
  }

  const defaultCollection: LocalCollection = {
    id: crypto.randomUUID(),
    userId,
    name: "Bookmarks",
    slug: "bookmarks",
    color: "#F2542C",
    isDefault: true,
    syncStatus: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.collections.add(defaultCollection);
  return defaultCollection;
}
