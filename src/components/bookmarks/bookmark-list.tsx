import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookmarkItem } from "./bookmark-item";
import type { LocalItem, LocalCollection } from "@/lib/dexie";

interface BookmarkListProps {
  items: LocalItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRefetch: (id: string) => void;
  collections: LocalCollection[];
  onMoveToCollection: (itemId: string, collectionId: string) => void;
}

export function BookmarkList({
  items,
  selectedIds,
  onToggleSelect,
  onDelete,
  onRefetch,
  collections,
  onMoveToCollection,
}: BookmarkListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    // Dynamic size based on item type
    estimateSize: (index) => {
      const item = items[index];
      if (!item) return 80;

      // BOOKMARK: title + description + favicon = taller
      if (item.type === "BOOKMARK") return 85;
      // COLOR/TEXT: simpler layout = shorter
      return 70;
    },
    overscan: 10, // Increased for smoother scrolling
  });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg font-medium">No bookmarks yet</p>
        <p className="text-sm mt-2">Add your first bookmark above</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-[calc(100vh-300px)] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];

          return (
            <div
              key={item.id}
              id={`bookmark-${item.id}`}
              data-bookmark-id={item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <BookmarkItem
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => onToggleSelect(item.id)}
                onDelete={() => onDelete(item.id)}
                onRefetch={() => onRefetch(item.id)}
                collections={collections}
                onMoveToCollection={(collectionId) =>
                  onMoveToCollection(item.id, collectionId)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
