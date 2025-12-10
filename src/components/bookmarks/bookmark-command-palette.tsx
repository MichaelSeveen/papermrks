import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import {
  Autocomplete,
  AutocompleteInput,
  AutocompletePopup,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "../ui/autocomplete";
import { Kbd } from "../ui/kbd";
import { useHotkeys } from "react-hotkeys-hook";
import type { LocalItem } from "@/lib/dexie";
import { Icon } from "@iconify/react";

interface BookmarkCommandPaletteProps {
  items: LocalItem[];
  onSelectItem: (item: LocalItem) => void;
}

export function BookmarkCommandPalette({
  items,
  onSelectItem,
}: BookmarkCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Cmd+K to open
  useHotkeys(
    "mod+k",
    (e: KeyboardEvent) => {
      e.preventDefault();
      setOpen(true);
    },
    { enableOnFormTags: true }
  );

  // Filter items (client-side, instant)
  const filteredItems = items
    .filter((item) => {
      if (item.isDeleted) return false;
      if (!searchTerm) return true;

      const query = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.url?.toLowerCase().includes(query) ||
        item.colorValue?.toLowerCase().includes(query)
      );
    })
    .slice(0, 50); // Limit results

  const handleSelect = useCallback(
    (item: LocalItem) => {
      onSelectItem(item);
      setOpen(false);
      setSearchTerm("");
    },
    [onSelectItem]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <Autocomplete
          items={filteredItems}
          value={searchTerm}
          onValueChange={(value) => {
            const selectedItem = filteredItems.find(
              (item) => item.title === value
            );
            if (selectedItem) {
              handleSelect(selectedItem);
            }
          }}
          autoHighlight
        >
          <div className="border-b p-4">
            <div className="flex items-center gap-2">
              <Icon
                icon="solar:magnifer-bold-duotone"
                className="size-5 text-muted-foreground"
              />
              <AutocompleteInput
                placeholder="Search bookmarks, colors, text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="flex-1 border-0 focus-visible:ring-0 shadow-none p-0"
              />
              <Kbd>Esc</Kbd>
            </div>
          </div>

          <AutocompletePopup className="border-0 shadow-none static">
            <AutocompleteEmpty className="p-8">
              <div className="flex flex-col items-center gap-2">
                <Icon
                  icon="solar:ghost-bold-duotone"
                  className="size-12 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  No bookmarks found. Try a different search.
                </p>
              </div>
            </AutocompleteEmpty>
            <AutocompleteList className="max-h-[400px] p-2">
              {(item: LocalItem) => (
                <AutocompleteItem
                  key={item.id}
                  value={item}
                  className="cursor-pointer rounded-lg p-3"
                >
                  <ItemPreview item={item} />
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompletePopup>
        </Autocomplete>
      </DialogContent>
    </Dialog>
  );
}

// Preview component for each item
function ItemPreview({ item }: { item: LocalItem }) {
  if (item.type === "COLOR") {
    return (
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-lg border border-border shadow-sm"
          style={{ backgroundColor: item.colorValue }}
        />
        <div>
          <div className="font-medium">{item.colorValue}</div>
          <div className="text-xs text-muted-foreground">Color</div>
        </div>
      </div>
    );
  }

  if (item.type === "TEXT") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-lg bg-muted">
          <Icon icon="solar:text-circle-bold-duotone" className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium line-clamp-1">{item.title}</div>
          <div className="text-xs text-muted-foreground">Text note</div>
        </div>
      </div>
    );
  }

  // BOOKMARK
  return (
    <div className="flex items-center gap-3">
      {item.favicon ? (
        <img
          src={item.favicon}
          alt=""
          className="size-10 rounded-lg object-cover border border-border"
        />
      ) : (
        <div className="flex items-center justify-center size-10 rounded-lg bg-muted">
          <Icon icon="solar:global-line-duotone" className="size-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium line-clamp-1">{item.title}</div>
        {item.url && (
          <div className="text-xs text-muted-foreground line-clamp-1">
            {new URL(item.url).hostname}
          </div>
        )}
      </div>
    </div>
  );
}
