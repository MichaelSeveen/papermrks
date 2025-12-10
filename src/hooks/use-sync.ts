import { useEffect, useState, useCallback, useRef } from "react";
import { AutoSyncManager } from "@/helpers/db-sync";
import type { SyncResult } from "@/helpers/db-sync";
import { getDB, ensureDefaultCollection } from "@/lib/dexie";

export interface UseSyncOptions {
  /**
   * Auto-sync interval in milliseconds
   * @default 30000 (30 seconds)
   */
  intervalMs?: number;

  /**
   * Whether to start auto-sync immediately
   * @default true
   */
  autoStart?: boolean;
}

export interface UseSyncReturn {
  /**
   * Whether sync is currently in progress
   */
  isSyncing: boolean;

  /**
   * Last sync result (null if never synced)
   */
  lastSyncResult: SyncResult | null;

  /**
   * Last sync timestamp
   */
  lastSyncedAt: number | null;

  /**
   * Whether the device is online
   */
  isOnline: boolean;

  /**
   * Manually trigger a sync
   */
  syncNow: () => Promise<SyncResult>;

  /**
   * Start auto-sync
   */
  startAutoSync: () => void;

  /**
   * Stop auto-sync
   */
  stopAutoSync: () => void;
}

/**
 * Hook to manage background sync between IndexedDB and server
 *
 * @example
 * ```tsx
 * const { isSyncing, lastSyncResult, syncNow } = useSync(userId);
 *
 * // Manual sync button
 * <Button onClick={syncNow} disabled={isSyncing}>
 *   {isSyncing ? 'Syncing...' : 'Sync Now'}
 * </Button>
 * ```
 */
export function useSync(
  userId: string | undefined,
  options: UseSyncOptions = {}
): UseSyncReturn {
  const { intervalMs = 30000, autoStart = true } = options;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const syncManagerRef = useRef<AutoSyncManager | null>(null);

  // Initialize sync manager when userId changes
  useEffect(() => {
    if (!userId) {
      // Cleanup if no user
      if (syncManagerRef.current) {
        syncManagerRef.current.destroy();
        syncManagerRef.current = null;
      }
      return;
    }

    // Create sync manager
    syncManagerRef.current = new AutoSyncManager(userId, "/api");

    // Ensure default collection exists
    const db = getDB(userId);
    ensureDefaultCollection(db, userId).catch(console.error);

    // Start auto-sync if enabled
    if (autoStart) {
      syncManagerRef.current.start(intervalMs);
    }

    // Cleanup on unmount
    return () => {
      if (syncManagerRef.current) {
        syncManagerRef.current.destroy();
        syncManagerRef.current = null;
      }
    };
  }, [userId, autoStart, intervalMs]);

  // Listen for online/offline events
  useEffect(() => {
    // secure check for navigator
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /**
   * Manually trigger sync
   */
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!syncManagerRef.current) {
      return {
        success: false,
        itemsSynced: 0,
        collectionsSynced: 0,
        tagsSynced: 0,
        itemsDeleted: 0,
        collectionsDeleted: 0,
        tagsDeleted: 0,
        errors: ["Sync manager not initialized"],
        warnings: [],
      };
    }

    setIsSyncing(true);

    try {
      const result = await syncManagerRef.current.syncNow();
      setLastSyncResult(result);
      setLastSyncedAt(Date.now());
      return result;
    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        itemsSynced: 0,
        collectionsSynced: 0,
        tagsSynced: 0,
        itemsDeleted: 0,
        collectionsDeleted: 0,
        tagsDeleted: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        warnings: [],
      };
      setLastSyncResult(errorResult);
      return errorResult;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Start auto-sync
   */
  const startAutoSync = useCallback(() => {
    if (syncManagerRef.current) {
      syncManagerRef.current.start(intervalMs);
    }
  }, [intervalMs]);

  /**
   * Stop auto-sync
   */
  const stopAutoSync = useCallback(() => {
    if (syncManagerRef.current) {
      syncManagerRef.current.stop();
    }
  }, []);

  return {
    isSyncing,
    lastSyncResult,
    lastSyncedAt,
    isOnline,
    syncNow,
    startAutoSync,
    stopAutoSync,
  };
}
