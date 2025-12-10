import {
  getDB,
  type LocalItem,
  type LocalCollection,
  type LocalTag,
  type LocalItemTag,
  type SyncQueue,
  type SyncStatus,
} from "@/lib/dexie";

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  collectionsSynced: number;
  tagsSynced: number;
  itemsDeleted: number;
  collectionsDeleted: number;
  tagsDeleted: number;
  errors: string[];
  warnings: string[];
}

export interface SyncPayload {
  items: LocalItem[];
  collections: LocalCollection[];
  tags: LocalTag[];
  itemTags: LocalItemTag[];
  deletions: {
    itemIds: string[];
    collectionIds: string[];
    tagIds: string[];
  };
}

export interface ServerResponse {
  success: boolean;
  synced: {
    items: string[];
    collections: string[];
    tags: string[];
    itemTags: Array<{ itemId: string; tagId: string }>;
  };
  deleted: {
    items: string[];
    collections: string[];
    tags: string[];
  };
  conflicts?: Array<{
    entity: string;
    entityId: string;
    reason: string;
  }>;
}

export interface SyncOptions {
  chunkSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

const DEFAULT_SYNC_OPTIONS: Required<SyncOptions> = {
  chunkSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
};

/**
 * Main sync orchestrator
 * Batches all unsynced data and sends to server with proper error handling
 * Implements chunking, retry logic, and soft-delete support
 */
export class SyncEngine {
  private userId: string;
  private apiBaseUrl: string;
  private syncInProgress: boolean = false;
  private options: Required<SyncOptions>;

  constructor(
    userId: string,
    apiBaseUrl: string = "/api",
    options: SyncOptions = {}
  ) {
    this.userId = userId;
    this.apiBaseUrl = apiBaseUrl;
    this.options = { ...DEFAULT_SYNC_OPTIONS, ...options };
  }

  /**
   * Performs a full sync of all unsynced data
   * Called manually or on an interval
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        itemsSynced: 0,
        collectionsSynced: 0,
        tagsSynced: 0,
        itemsDeleted: 0,
        collectionsDeleted: 0,
        tagsDeleted: 0,
        errors: ["Sync already in progress"],
        warnings: [],
      };
    }

    this.syncInProgress = true;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const db = getDB(this.userId);

      // Step 1: Process any pending retries first
      await this.processRetryQueue(db);

      // Step 2: Gather all pending data (excluding soft-deleted items)
      const payload = await this.gatherPendingData(db);

      if (this.isPayloadEmpty(payload)) {
        // Step 3: Even if no new data, pull server changes
        await this.pullServerChanges(db);

        return {
          success: true,
          itemsSynced: 0,
          collectionsSynced: 0,
          tagsSynced: 0,
          itemsDeleted: 0,
          collectionsDeleted: 0,
          tagsDeleted: 0,
          errors: [],
          warnings: [],
        };
      }

      // Step 4: Mark items as "syncing" before sending
      await this.markAsSyncing(db, payload);

      // Step 5: Chunk large payloads to avoid overwhelming the server
      const chunks = this.chunkPayload(payload);
      let totalSynced = {
        items: 0,
        collections: 0,
        tags: 0,
        itemsDeleted: 0,
        collectionsDeleted: 0,
        tagsDeleted: 0,
      };

      // Step 6: Send each chunk to server
      for (const chunk of chunks) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/bookmarks/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
            credentials: "include",
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Sync failed: ${error}`);
          }

          const result: ServerResponse = await response.json();

          // Validate server response structure
          if (!this.validateServerResponse(result)) {
            throw new Error("Invalid server response format");
          }

          // Step 7: Mark items as synced locally
          await this.markAsSynced(db, result);

          // Track what was synced
          totalSynced.items += result.synced.items.length;
          totalSynced.collections += result.synced.collections.length;
          totalSynced.tags += result.synced.tags.length;
          totalSynced.itemsDeleted += result.deleted.items.length;
          totalSynced.collectionsDeleted += result.deleted.collections.length;
          totalSynced.tagsDeleted += result.deleted.tags.length;

          // Log conflicts if any
          if (result.conflicts && result.conflicts.length > 0) {
            warnings.push(
              `${result.conflicts.length} conflicts detected: ${result.conflicts
                .map((c) => `${c.entity}:${c.entityId}`)
                .join(", ")}`
            );
          }
        } catch (chunkError) {
          errors.push(
            `Chunk sync failed: ${chunkError instanceof Error ? chunkError.message : "Unknown error"}`
          );

          // Mark failed items as error
          await this.markAsError(db, chunk, chunkError);

          // Add failed chunk to retry queue
          await this.addChunkToRetryQueue(db, chunk, chunkError);
        }
      }

      // Step 8: Pull any server changes we don't have
      await this.pullServerChanges(db);

      return {
        success: errors.length === 0,
        itemsSynced: totalSynced.items,
        collectionsSynced: totalSynced.collections,
        tagsSynced: totalSynced.tags,
        itemsDeleted: totalSynced.itemsDeleted,
        collectionsDeleted: totalSynced.collectionsDeleted,
        tagsDeleted: totalSynced.tagsDeleted,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error");

      return {
        success: false,
        itemsSynced: 0,
        collectionsSynced: 0,
        tagsSynced: 0,
        itemsDeleted: 0,
        collectionsDeleted: 0,
        tagsDeleted: 0,
        errors,
        warnings,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Gathers all pending entities from IndexedDB
   * Uses indexed queries for better performance
   */
  private async gatherPendingData(
    db: ReturnType<typeof getDB>
  ): Promise<SyncPayload> {
    // Fetch pending (not yet synced) entities that are not deleted
    const [items, collections, tags, itemTags] = await Promise.all([
      db.items
        .where("syncStatus")
        .anyOf("pending", "error")
        .filter((item) => !item.isDeleted)
        .toArray(),
      db.collections
        .where("syncStatus")
        .anyOf("pending", "error")
        .filter((col) => !col.isDeleted)
        .toArray(),
      db.tags
        .where("syncStatus")
        .anyOf("pending", "error")
        .filter((tag) => !tag.isDeleted)
        .toArray(),
      db.itemTags.where("syncStatus").anyOf("pending", "error").toArray(),
    ]);

    // Fetch soft-deleted entities that need to be synced as deletions
    const [deletedItems, deletedCollections, deletedTags] = await Promise.all([
      db.items
        .where("syncStatus")
        .anyOf("pending", "error")
        .filter((item) => item.isDeleted === true)
        .toArray(),
      db.collections
        .where("syncStatus")
        .anyOf("pending", "error")
        .filter((col) => col.isDeleted === true)
        .toArray(),
      db.tags
        .where("syncStatus")
        .anyOf("pending", "error")
        .filter((tag) => tag.isDeleted === true)
        .toArray(),
    ]);

    return {
      items,
      collections,
      tags,
      itemTags,
      deletions: {
        itemIds: deletedItems.map((i) => i.id),
        collectionIds: deletedCollections.map((c) => c.id),
        tagIds: deletedTags.map((t) => t.id),
      },
    };
  }

  /**
   * Marks entities as "syncing" before sending to server
   */
  private async markAsSyncing(
    db: ReturnType<typeof getDB>,
    payload: SyncPayload
  ): Promise<void> {
    await db.transaction(
      "rw",
      [db.items, db.collections, db.tags, db.itemTags],
      async () => {
        if (payload.items.length > 0) {
          await db.items.bulkUpdate(
            payload.items.map((item) => ({
              key: item.id,
              changes: { syncStatus: "syncing" as SyncStatus },
            }))
          );
        }

        if (payload.collections.length > 0) {
          await db.collections.bulkUpdate(
            payload.collections.map((col) => ({
              key: col.id,
              changes: { syncStatus: "syncing" as SyncStatus },
            }))
          );
        }

        if (payload.tags.length > 0) {
          await db.tags.bulkUpdate(
            payload.tags.map((tag) => ({
              key: tag.id,
              changes: { syncStatus: "syncing" as SyncStatus },
            }))
          );
        }

        if (payload.itemTags.length > 0) {
          await db.itemTags.bulkUpdate(
            payload.itemTags.map((it) => ({
              key: [it.itemId, it.tagId] as [string, string],
              changes: { syncStatus: "syncing" as SyncStatus },
            }))
          );
        }
      }
    );
  }

  /**
   * Chunks payload into smaller batches to avoid overwhelming server
   */
  private chunkPayload(payload: SyncPayload): SyncPayload[] {
    const chunks: SyncPayload[] = [];
    const { chunkSize } = this.options;

    // If payload is small enough, return as single chunk
    const totalSize =
      payload.items.length +
      payload.collections.length +
      payload.tags.length +
      payload.itemTags.length;

    if (totalSize <= chunkSize) {
      return [payload];
    }

    // Split items into chunks
    for (let i = 0; i < payload.items.length; i += chunkSize) {
      chunks.push({
        items: payload.items.slice(i, i + chunkSize),
        collections: i === 0 ? payload.collections : [],
        tags: i === 0 ? payload.tags : [],
        itemTags: i === 0 ? payload.itemTags : [],
        deletions:
          i === 0
            ? payload.deletions
            : { itemIds: [], collectionIds: [], tagIds: [] },
      });
    }

    return chunks;
  }

  /**
   * Marks synced entities as "synced" in IndexedDB
   */
  private async markAsSynced(
    db: ReturnType<typeof getDB>,
    serverResponse: ServerResponse
  ): Promise<void> {
    const now = Date.now();

    await db.transaction(
      "rw",
      [db.items, db.collections, db.tags, db.itemTags],
      async () => {
        // Mark items as synced
        if (serverResponse.synced.items.length > 0) {
          await db.items.bulkUpdate(
            serverResponse.synced.items.map((id) => ({
              key: id,
              changes: {
                syncStatus: "synced" as SyncStatus,
                lastSyncedAt: now,
                syncError: undefined,
              },
            }))
          );
        }

        // Mark collections as synced
        if (serverResponse.synced.collections.length > 0) {
          await db.collections.bulkUpdate(
            serverResponse.synced.collections.map((id) => ({
              key: id,
              changes: {
                syncStatus: "synced" as SyncStatus,
                lastSyncedAt: now,
                syncError: undefined,
              },
            }))
          );
        }

        // Mark tags as synced
        if (serverResponse.synced.tags.length > 0) {
          await db.tags.bulkUpdate(
            serverResponse.synced.tags.map((id) => ({
              key: id,
              changes: {
                syncStatus: "synced" as SyncStatus,
                lastSyncedAt: now,
                syncError: undefined,
              },
            }))
          );
        }

        // Mark itemTags as synced
        if (serverResponse.synced.itemTags.length > 0) {
          await db.itemTags.bulkUpdate(
            serverResponse.synced.itemTags.map((it) => ({
              key: [it.itemId, it.tagId] as [string, string],
              changes: {
                syncStatus: "synced" as SyncStatus,
              },
            }))
          );
        }

        // Delete soft-deleted items that were successfully synced
        if (serverResponse.deleted.items.length > 0) {
          await db.items.bulkDelete(serverResponse.deleted.items);
        }

        if (serverResponse.deleted.collections.length > 0) {
          await db.collections.bulkDelete(serverResponse.deleted.collections);
        }

        if (serverResponse.deleted.tags.length > 0) {
          await db.tags.bulkDelete(serverResponse.deleted.tags);
        }
      }
    );
  }

  /**
   * Marks failed entities as "error" with error message
   */
  private async markAsError(
    db: ReturnType<typeof getDB>,
    chunk: SyncPayload,
    error: unknown
  ): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await db.transaction(
      "rw",
      [db.items, db.collections, db.tags, db.itemTags],
      async () => {
        if (chunk.items.length > 0) {
          await db.items.bulkUpdate(
            chunk.items.map((item) => ({
              key: item.id,
              changes: {
                syncStatus: "error" as SyncStatus,
                syncError: errorMessage,
              },
            }))
          );
        }

        if (chunk.collections.length > 0) {
          await db.collections.bulkUpdate(
            chunk.collections.map((col) => ({
              key: col.id,
              changes: {
                syncStatus: "error" as SyncStatus,
                syncError: errorMessage,
              },
            }))
          );
        }

        if (chunk.tags.length > 0) {
          await db.tags.bulkUpdate(
            chunk.tags.map((tag) => ({
              key: tag.id,
              changes: {
                syncStatus: "error" as SyncStatus,
                syncError: errorMessage,
              },
            }))
          );
        }

        if (chunk.itemTags.length > 0) {
          await db.itemTags.bulkUpdate(
            chunk.itemTags.map((it) => ({
              key: [it.itemId, it.tagId] as [string, string],
              changes: {
                syncStatus: "error" as SyncStatus,
              },
            }))
          );
        }
      }
    );
  }

  /**
   * Pulls changes from server that we don't have locally
   * Implements last-write-wins conflict resolution
   */
  private async pullServerChanges(db: ReturnType<typeof getDB>): Promise<void> {
    try {
      const lastSync = await this.getLastSyncTimestamp(db);

      const response = await fetch(
        `${this.apiBaseUrl}/bookmarks/sync?since=${lastSync}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch server changes");
      }

      const serverData: SyncPayload = await response.json();

      // Merge server data into local DB using transaction
      await db.transaction(
        "rw",
        [db.items, db.collections, db.tags, db.itemTags],
        async () => {
          await Promise.all([
            this.mergeItems(db, serverData.items),
            this.mergeCollections(db, serverData.collections),
            this.mergeTags(db, serverData.tags),
            this.mergeItemTags(db, serverData.itemTags),
          ]);
        }
      );
    } catch (error) {
      console.error("Error pulling server changes:", error);
      // Don't throw - pulling is optional, pushing is critical
    }
  }

  /**
   * Merges server items into local DB (last-write-wins)
   */
  private async mergeItems(
    db: ReturnType<typeof getDB>,
    serverItems: LocalItem[]
  ): Promise<void> {
    if (!serverItems || serverItems.length === 0) return;

    const localItems = await db.items.bulkGet(serverItems.map((i) => i.id));
    const itemsToUpdate: LocalItem[] = [];

    for (let i = 0; i < serverItems.length; i++) {
      const serverItem = serverItems[i];
      const localItem = localItems[i];

      // Update if: no local item, or server is newer
      if (!localItem || serverItem.updatedAt > localItem.updatedAt) {
        itemsToUpdate.push({
          ...serverItem,
          syncStatus: "synced",
          lastSyncedAt: Date.now(),
        });
      }
    }

    if (itemsToUpdate.length > 0) {
      await db.items.bulkPut(itemsToUpdate);
    }
  }

  /**
   * Merges server collections into local DB
   */
  private async mergeCollections(
    db: ReturnType<typeof getDB>,
    serverCollections: LocalCollection[]
  ): Promise<void> {
    if (!serverCollections || serverCollections.length === 0) return;

    const localCollections = await db.collections.bulkGet(
      serverCollections.map((c) => c.id)
    );
    const collectionsToUpdate: LocalCollection[] = [];

    for (let i = 0; i < serverCollections.length; i++) {
      const serverCol = serverCollections[i];
      const localCol = localCollections[i];

      if (!localCol || serverCol.updatedAt > localCol.updatedAt) {
        collectionsToUpdate.push({
          ...serverCol,
          syncStatus: "synced",
          lastSyncedAt: Date.now(),
        });
      }
    }

    if (collectionsToUpdate.length > 0) {
      await db.collections.bulkPut(collectionsToUpdate);
    }
  }

  /**
   * Merges server tags into local DB
   */
  private async mergeTags(
    db: ReturnType<typeof getDB>,
    serverTags: LocalTag[]
  ): Promise<void> {
    if (!serverTags || serverTags.length === 0) return;

    const localTags = await db.tags.bulkGet(serverTags.map((t) => t.id));
    const tagsToUpdate: LocalTag[] = [];

    for (let i = 0; i < serverTags.length; i++) {
      const serverTag = serverTags[i];
      const localTag = localTags[i];

      if (
        !localTag ||
        (serverTag.updatedAt &&
          localTag.updatedAt &&
          serverTag.updatedAt > localTag.updatedAt)
      ) {
        tagsToUpdate.push({
          ...serverTag,
          syncStatus: "synced",
          lastSyncedAt: Date.now(),
        });
      } else if (!localTag) {
        // New tag from server
        tagsToUpdate.push({
          ...serverTag,
          syncStatus: "synced",
          lastSyncedAt: Date.now(),
        });
      }
    }

    if (tagsToUpdate.length > 0) {
      await db.tags.bulkPut(tagsToUpdate);
    }
  }

  /**
   * Merges server itemTags into local DB
   */
  private async mergeItemTags(
    db: ReturnType<typeof getDB>,
    serverItemTags: LocalItemTag[]
  ): Promise<void> {
    if (!serverItemTags || serverItemTags.length === 0) return;

    const localItemTags = await db.itemTags.bulkGet(
      serverItemTags.map((it) => [it.itemId, it.tagId] as [string, string])
    );

    const itemTagsToUpdate: LocalItemTag[] = [];

    for (let i = 0; i < serverItemTags.length; i++) {
      const serverIT = serverItemTags[i];
      const localIT = localItemTags[i];

      if (!localIT) {
        itemTagsToUpdate.push({
          ...serverIT,
          syncStatus: "synced",
        });
      }
    }

    if (itemTagsToUpdate.length > 0) {
      await db.itemTags.bulkPut(itemTagsToUpdate);
    }
  }

  /**
   * Gets timestamp of last successful sync across all entities
   */
  private async getLastSyncTimestamp(
    db: ReturnType<typeof getDB>
  ): Promise<number> {
    const [lastItem, lastCollection, lastTag] = await Promise.all([
      db.items.orderBy("lastSyncedAt").reverse().first(),
      db.collections.orderBy("lastSyncedAt").reverse().first(),
      db.tags.orderBy("lastSyncedAt").reverse().first(),
    ]);

    const timestamps = [
      lastItem?.lastSyncedAt || 0,
      lastCollection?.lastSyncedAt || 0,
      lastTag?.lastSyncedAt || 0,
    ];

    return Math.max(...timestamps);
  }

  /**
   * Processes items in the retry queue with exponential backoff
   */
  private async processRetryQueue(db: ReturnType<typeof getDB>): Promise<void> {
    const now = Date.now();

    const retryItems = await db.syncQueue
      .where("nextRetryAt")
      .below(now)
      .toArray();

    for (const item of retryItems) {
      if (item.retryCount >= item.maxRetries) {
        console.error(
          `Max retries exceeded for ${item.entity}:${item.entityId}`,
          item.error
        );
        await db.syncQueue.delete(item.id);
        continue;
      }

      try {
        const nextDelay = this.calculateBackoff(item.retryCount);
        await db.syncQueue.update(item.id, {
          retryCount: item.retryCount + 1,
          lastAttemptAt: now,
          nextRetryAt: now + nextDelay,
        });
      } catch (error) {
        const nextDelay = this.calculateBackoff(item.retryCount);
        await db.syncQueue.update(item.id, {
          retryCount: item.retryCount + 1,
          lastAttemptAt: now,
          nextRetryAt: now + nextDelay,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  /**
   * Adds a failed chunk to the retry queue
   */
  private async addChunkToRetryQueue(
    db: ReturnType<typeof getDB>,
    chunk: SyncPayload,
    error: unknown
  ): Promise<void> {
    const now = Date.now();
    const queueItem: SyncQueue = {
      id: crypto.randomUUID(),
      operation: "create",
      entity: "item",
      entityId: "batch_sync",
      data: chunk as unknown as Record<string, unknown>,
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      nextRetryAt: now + this.options.retryDelayMs,
      error: error instanceof Error ? error.message : "Unknown error",
      createdAt: now,
    };

    await db.syncQueue.add(queueItem);
  }

  /**
   * Calculates exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    return this.options.retryDelayMs * Math.pow(2, retryCount);
  }

  /**
   * Validates server response structure
   */
  private validateServerResponse(
    response: unknown
  ): response is ServerResponse {
    if (!response || typeof response !== "object") return false;

    const r = response as Partial<ServerResponse>;

    return (
      typeof r.success === "boolean" &&
      r.synced !== undefined &&
      typeof r.synced === "object" &&
      Array.isArray((r.synced as ServerResponse["synced"]).items) &&
      Array.isArray((r.synced as ServerResponse["synced"]).collections) &&
      Array.isArray((r.synced as ServerResponse["synced"]).tags) &&
      r.deleted !== undefined &&
      typeof r.deleted === "object" &&
      Array.isArray((r.deleted as ServerResponse["deleted"]).items)
    );
  }

  /**
   * Checks if payload has any data to sync
   */
  private isPayloadEmpty(payload: SyncPayload): boolean {
    return (
      payload.items.length === 0 &&
      payload.collections.length === 0 &&
      payload.tags.length === 0 &&
      payload.itemTags.length === 0 &&
      payload.deletions.itemIds.length === 0 &&
      payload.deletions.collectionIds.length === 0 &&
      payload.deletions.tagIds.length === 0
    );
  }
}

/**
 * Auto-sync manager
 * Runs sync on interval and when online
 */
export class AutoSyncManager {
  private syncEngine: SyncEngine;
  private intervalId: number | null = null;
  private isOnline: boolean = navigator.onLine;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(userId: string, apiBaseUrl?: string, options?: SyncOptions) {
    this.syncEngine = new SyncEngine(userId, apiBaseUrl, options);
    this.setupEventListeners();
  }

  /**
   * Starts auto-sync with specified interval
   */
  start(intervalMs: number = 30000): void {
    this.stop();

    this.intervalId = window.setInterval(() => {
      if (this.isOnline) {
        this.syncEngine.sync().catch(console.error);
      }
    }, intervalMs);

    // Sync immediately when starting
    if (this.isOnline) {
      this.syncEngine.sync().catch(console.error);
    }
  }

  /**
   * Stops auto-sync
   */
  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Manually trigger sync
   */
  async syncNow(): Promise<SyncResult> {
    return await this.syncEngine.sync();
  }

  /**
   * Sets up online/offline listeners
   */
  private setupEventListeners(): void {
    this.onlineHandler = () => {
      this.isOnline = true;
      this.syncEngine.sync().catch(console.error);
    };

    this.offlineHandler = () => {
      this.isOnline = false;
    };

    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
  }

  /**
   * Cleanup - removes event listeners
   */
  destroy(): void {
    this.stop();

    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.offlineHandler) {
      window.removeEventListener("offline", this.offlineHandler);
      this.offlineHandler = null;
    }
  }
}
