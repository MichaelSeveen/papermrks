import { File02Icon, Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { LocalItem } from "@/lib/dexie";
import {
  CommandDialog,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
  CommandGroup,
} from "../ui/command";

interface BookmarkCommandPaletteProps {
  items: LocalItem[];
  onSelectItem: (id: string) => void;
}

export function BookmarkCommandPalette({
  items,
  onSelectItem,
}: BookmarkCommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useHotkeys(
    "mod+k",
    (e: KeyboardEvent) => {
      e.preventDefault();
      setOpen(true);
    },
    { enableOnFormTags: true }
  );

  const visibleItems = items.filter((item) => !item.isDeleted).slice(0, 50);

  const handleSelect = useCallback(
    (itemId: string) => {
      onSelectItem(itemId);
      setOpen(false);
    },
    [onSelectItem]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search bookmarks..." />
      <CommandList>
        <CommandEmpty>No bookmarks found.</CommandEmpty>
        <CommandGroup heading="Bookmarks">
          {visibleItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.title} ${item.description ?? ""} ${item.normalizedUrl ?? ""} ${item.colorValue ?? ""}`}
              onSelect={() => handleSelect(item.id)}
              className="cursor-pointer"
            >
              <ItemIconPreview item={item} />
              <span className="truncate">{item.title}</span>
              {item.normalizedUrl && (
                <Link
                  to={item.normalizedUrl}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {item.rawInput}
                </Link>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function ItemIconPreview({ item }: { item: LocalItem }) {
  switch (item.type) {
    case "COLOR":
      return (
        <div
          className="size-5 rounded-full shrink-0"
          style={{ backgroundColor: item.colorValue }}
        />
      );
    case "TEXT":
      return <HugeiconsIcon icon={File02Icon} className="size-4 shrink-0" />;
    case "BOOKMARK":
      return item.favicon ? (
        <img
          src={item.favicon}
          alt={`${item.title} favicon`}
          className="size-4 rounded shrink-0"
        />
      ) : (
        <HugeiconsIcon icon={Globe02Icon} className="size-4 shrink-0" />
      );
  }
}
