import { useState, useCallback, useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useSync } from "@/hooks/use-sync";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/dexie";
import { BookmarkInput } from "@/components/bookmarks/bookmark-input";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";
import { BookmarkCommandPalette } from "@/components/bookmarks/bookmark-command-palette";
import { CollectionSwitcher } from "@/components/collections/collection-switcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LocalItem } from "@/lib/dexie";
import { signOut } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad({ context }) {
    if (!context.user) {
      throw redirect({
        to: "/sign-in",
      });
    }

    return { user: context.user };
  },
  component: HomePage,
});

function HomePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [manualSyncResult, setManualSyncResult] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | undefined
  >(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load collections
  const collections = useLiveQuery(async () => {
    if (!user.id) return [];
    const db = getDB(user.id);
    return await db.collections.filter((c) => !c.isDeleted).toArray();
  }, [user.id]);

  // Select default collection on load
  useEffect(() => {
    if (collections && collections.length > 0 && !selectedCollectionId) {
      const defaultCol = collections.find((c) => c.isDefault);
      if (defaultCol) {
        setSelectedCollectionId(defaultCol.id);
      } else {
        // Fallback to first if no default
        setSelectedCollectionId(collections[0].id);
      }
    }
  }, [collections, selectedCollectionId]);

  // Use bookmarks hook (scoped to selected collection)
  const {
    items,
    isProcessing,
    addItem,
    addMultipleItems,
    deleteItems,
    refetchMetadata,
  } = useBookmarks(user.id, selectedCollectionId);

  // Use sync hook (replaces manual AutoSyncManager)
  const { isSyncing, isOnline, syncNow } = useSync(user.id);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (confirm(`Delete ${selectedIds.size} items?`)) {
      await deleteItems(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleManualSync = async () => {
    const result = await syncNow();
    if (result.success) {
      // alert(`Synced: ${result.itemsSynced} items`);
      setManualSyncResult(`Synced: ${result.itemsSynced} items`);
    } else {
      // alert(`Sync failed: ${result.errors.join(", ")}`);
      setManualSyncResult(`Sync failed: ${result.errors.join(", ")}`);
    }
  };

  function handleLogout() {
    signOut({
      fetchOptions: {
        onSuccess() {
          navigate({
            to: "/sign-in",
          });
        },
      },
    });
  }

  // Scroll to item when selected from command palette
  const handleSelectFromPalette = useCallback((item: LocalItem) => {
    const element = document.getElementById(`bookmark-${item.id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });

      // Briefly highlight
      element.classList.add("ring-2", "ring-primary", "transition-all");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-primary");
      }, 2000);
    }
  }, []);

  // Move item to different collection (offline-first)
  const handleMoveItem = useCallback(
    async (itemId: string, targetCollectionId: string) => {
      if (!user.id) return;

      const db = getDB(user.id);

      // Optimistic update to IndexedDB
      await db.items.update(itemId, {
        collectionId: targetCollectionId,
        syncStatus: "pending",
        updatedAt: Date.now(),
      });

      // Sync manager will automatically sync this change to server
      // by calling moveItemsToCollection server function
    },
    [user.id]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Command Palette (Cmd+K) */}
      <BookmarkCommandPalette
        items={items}
        onSelectItem={handleSelectFromPalette}
      />

      <header className="border-b bg-card p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Bookmarks</h1>

          <div className="flex items-center gap-4">
            {/* Sync Status */}
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-sm text-muted-foreground">
                {isSyncing ? "Syncing..." : isOnline ? "Online" : "Offline"}
              </span>
            </div>

            <Button
              onClick={handleManualSync}
              disabled={isSyncing}
              size="sm"
              variant="outline"
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>

            {manualSyncResult && (
              <span className="ml-2 text-sm text-green-600 dark:text-green-400">
                {manualSyncResult}
              </span>
            )}

            {selectedIds.size > 0 && (
              <>
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
                <Button
                  onClick={handleBulkDelete}
                  variant="destructive"
                  size="sm"
                >
                  Delete Selected
                </Button>
              </>
            )}

            <div className="text-sm text-muted-foreground">{user.email}</div>
            <Button onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Collection Switcher */}
        <div className="max-w-xs">
          <CollectionSwitcher
            collections={collections || []}
            currentCollectionId={selectedCollectionId}
            onSelectCollection={setSelectedCollectionId}
          />
        </div>

        {/* Add Input */}
        <BookmarkInput
          onAdd={addItem}
          onAddMultiple={addMultipleItems}
          isProcessing={isProcessing}
        />

        {/* Bookmark List */}
        <BookmarkList
          items={items}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onDelete={(id) => deleteItems([id])}
          onRefetch={refetchMetadata}
          collections={collections || []}
          onMoveToCollection={handleMoveItem}
        />
      </main>
    </div>
  );
}
