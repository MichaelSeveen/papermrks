import { useRef } from "react";
import type { LocalItem, LocalCollection } from "@/lib/dexie";
import { ScrollArea } from "../ui/scroll-area";
import { BookmarkItem } from "./bookmark-item";
// import { useVirtualizer } from "@tanstack/react-virtual";

interface BookmarkListProps {
  items: LocalItem[];
  selectedIds: Set<string>;
  itemRefs: React.RefObject<{ [key: string]: HTMLDivElement | null }>;
  highlightedId: string | null;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRefetch: (id: string) => void;
  collections: LocalCollection[];
  onMoveToCollection: (itemId: string, collectionId: string) => void;
}

export function BookmarkList({
  items,
  selectedIds,
  itemRefs,
  highlightedId,
  onToggleSelect,
  onDelete,
  onRefetch,
  collections,
  onMoveToCollection,
}: BookmarkListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // const virtualizer = useVirtualizer({
  //   count: items.length,
  //   getScrollElement: () => parentRef.current,
  //   // Dynamic size based on item type
  //   estimateSize: (index) => {
  //     const item = items[index];
  //     if (!item) return 80;

  //     // BOOKMARK: title + description + favicon = taller
  //     if (item.type === "BOOKMARK") return 50;
  //     // COLOR/TEXT: simpler layout = shorter
  //     return 70;
  //   },
  //   overscan: 10, // Increased for smoother scrolling
  // });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg font-medium">No bookmarks yet</p>
        <p className="text-sm mt-2">Add your first bookmark above</p>
      </div>
    );
  }

  return (
    <ScrollArea ref={parentRef} className="h-[calc(100vh-18.75rem)]">
      <div>
        {items.map((item) => (
          <BookmarkItem
            key={item.id}
            ref={(el) => {
              itemRefs.current[item.id] = el;
            }}
            item={item}
            isHighlighted={highlightedId === item.id}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={() => onToggleSelect(item.id)}
            onDelete={() => onDelete(item.id)}
            onRefetch={() => onRefetch(item.id)}
            collections={collections}
            onMoveToCollection={(collectionId) =>
              onMoveToCollection(item.id, collectionId)
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}

{
  /* <div
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
            </div>
          );
        })}
      </div> */
}
