import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useCollections } from "@/hooks/use-collections";
import { useSync } from "@/hooks/use-sync";
import { getDB } from "@/lib/dexie";
import { BookmarkInput } from "@/components/bookmarks/bookmark-input";
import { BookmarkList } from "@/components/bookmarks/bookmark-list";
import { BookmarkCommandPalette } from "@/components/bookmarks/bookmark-command-palette";
import { CollectionSwitcher } from "@/components/collections/collection-switcher";
import { ConfirmRemove } from "@/components/global/confirm-remove";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { DatabaseSyncIcon, Logout02Icon } from "@hugeicons/core-free-icons";

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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();

  const { collections, addCollection } = useCollections(user.id);

  useEffect(() => {
    if (collections && collections.length > 0 && !selectedCollectionId) {
      const defaultCol = collections.find((c) => c.isDefault);
      if (defaultCol) {
        setSelectedCollectionId(defaultCol.id);
      } else {
        setSelectedCollectionId(collections[0].id);
      }
    }
  }, [collections, selectedCollectionId]);

  const {
    items,
    isProcessing,
    addItem,
    addMultipleItems,
    deleteItems,
    refetchMetadata,
  } = useBookmarks(user.id, selectedCollectionId);

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

  const handleBulkDelete = () => {
    startDeleteTransition(async () => {
      await deleteItems(Array.from(selectedIds));
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
    });
  };

  const handleManualSync = async () => {
    const result = await syncNow();
    if (result.success) {
      setManualSyncResult(`Synced: ${result.itemsSynced} items`);
    } else {
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

  const handleMoveItemToCollection = useCallback(
    async (itemId: string, targetCollectionId: string) => {
      if (!user.id) return;

      const db = getDB(user.id);

      await db.items.update(itemId, {
        collectionId: targetCollectionId,
        syncStatus: "pending",
        updatedAt: Date.now(),
      });
    },
    [user.id]
  );

  const scrollToItem = (id: string) => {
    const element = itemRefs.current[id];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  };
  return (
    <div className="h-svh bg-background">
      <div className="grid grid-cols-[1fr_calc(100%-2rem)_1fr] md:grid-cols-[1fr_min(calc(100%-5rem),calc(1200/16*1rem))_1fr] *:col-2 items-start gap-y-6">
        <header className="border-b bg-background p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="size-7"
                viewBox="0 0 30 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.35 18.655c3.764.216 4.194 4.986 2.307 3.115-1.06-1.05-1.63-1.49-3.15-1.22-.728.13-1.261.556-2.074 1.12-1.095.761-1.09-.947-.554-1.595.877-1.058 1.795-1.492 3.471-1.42m7.922-6.864c-.044-.622-.97-.946-1.18-.195-.117.416-.252.852-.472 1.227-.62 1.087-2.076.354-2.402-.575-.39-1.11-1.32-1.12-1.176.066.435 3.598 5.237 3.291 5.23-.523M0 15.469c0 19.624 29.72 19.2 30-.235C30-5.226 0-5.007 0 15.47m27.462-2.364c2.593 18.13-25.317 20.107-25.151 1.378 1.013-15.645 22.265-16.136 25.15-1.378m-15.22-1.011c-.03-.707-.56-1.23-.908-.534-.221.443-.35.93-.565 1.375-.49 1.116-1.99.398-2.339-.467-.417-1.034-1.314-1.378-1.301-.135.034 3.431 5.427 3.938 5.113-.24"
                  fill="var(--muted-foreground)"
                />
              </svg>
              <h1 className="text-xl font-semibold">Papermrks</h1>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={isOnline ? "success" : "destructive"}>
                {isSyncing ? "Syncing..." : isOnline ? "Online" : "Offline"}
              </Badge>

              {manualSyncResult && (
                <span className="ml-2 text-sm text-green-600 dark:text-green-400">
                  {manualSyncResult}
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" />}>
                  {user.name}
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Profile</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleManualSync}>
                      <HugeiconsIcon icon={DatabaseSyncIcon} />
                      {isSyncing ? "Syncing..." : "Sync Now"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      variant="destructive"
                    >
                      <HugeiconsIcon icon={Logout02Icon} />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="space-y-6">
          <div className="flex items-center justify-between">
            <CollectionSwitcher
              collections={collections}
              currentCollectionId={selectedCollectionId}
              onSelectCollection={setSelectedCollectionId}
              onAddCollection={addCollection}
            />
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  variant="destructive"
                  size="sm"
                >
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          <BookmarkInput
            onAdd={addItem}
            onAddMultiple={addMultipleItems}
            isProcessing={isProcessing}
          />

          <BookmarkList
            items={items}
            itemRefs={itemRefs}
            highlightedId={highlightedId}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onDelete={(id) => deleteItems([id])}
            onRefetch={refetchMetadata}
            collections={collections}
            onMoveToCollection={handleMoveItemToCollection}
          />
        </main>
      </div>
      <BookmarkCommandPalette items={items} onSelectItem={scrollToItem} />

      <ConfirmRemove
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        description={`This action cannot be undone. This will permanently delete ${selectedIds.size} selected bookmark${selectedIds.size === 1 ? "" : "s"}.`}
        isPending={isDeletePending}
      />
    </div>
  );
}
