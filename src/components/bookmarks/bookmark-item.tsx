import {
  Copy01Icon,
  Delete02Icon,
  File02Icon,
  Globe02Icon,
  MoreVerticalIcon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { useState, forwardRef } from "react";
import type { LocalItem, LocalCollection } from "@/lib/dexie";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
} from "../ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../ui/dropdown-menu";

interface BookmarkItemProps {
  item: LocalItem;
  isHighlighted: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onRefetch: () => void;
  collections: LocalCollection[];
  onMoveToCollection: (collectionId: string) => void;
}

export const BookmarkItem = forwardRef<HTMLDivElement, BookmarkItemProps>(
  (
    {
      item,
      isHighlighted,
      isSelected,
      onToggleSelect,
      onDelete,
      onRefetch,
      collections,
      onMoveToCollection,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyItem = async () => {
      const textToCopy =
        item.type === "BOOKMARK"
          ? (item.normalizedUrl as string)
          : item.type === "COLOR"
            ? (item.colorValue ?? item.title)
            : item.title;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const itemIcon = () => {
      switch (item.type) {
        case "COLOR":
          return (
            <div
              className="size-5 rounded-full"
              style={{ backgroundColor: item.colorValue }}
            />
          );
        case "TEXT":
          return (
            <HugeiconsIcon icon={File02Icon} className="size-5 shrink-0" />
          );

        case "BOOKMARK":
          return item.favicon ? (
            <img
              src={item.favicon}
              alt={`${item.title} favicon`}
              className="size-5 rounded shrink-0"
            />
          ) : (
            <HugeiconsIcon icon={Globe02Icon} className="size-5 shrink-0" />
          );
      }
    };

    const itemBadge = () => {
      switch (item.syncStatus) {
        case "pending":
          return <Badge variant="warning">Pending sync</Badge>;
        case "syncing":
          return <Badge variant="secondary">Syncing...</Badge>;
        case "error":
          return <Badge variant="destructive">Sync error</Badge>;
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex justify-between px-2 py-1.5 hover:bg-accent/50 transition-colors rounded",
          isSelected && "bg-accent",
          isHighlighted && "bg-accent/50"
        )}
        title={item.title}
      >
        <div className="flex items-center gap-x-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="shrink-0"
          />
          {itemIcon()}
          <div className="flex items-center gap-x-1.5 max-sm:max-w-50">
            <p className="text-sm font-semibold truncate">{item.title}</p>
            {item.normalizedUrl && (
              <Link
                to={item.normalizedUrl}
                className="hidden md:inline-block text-xs text-muted-foreground hover:underline"
              >
                {item.rawInput}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-x-3">
          {itemBadge()}
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <HugeiconsIcon icon={MoreVerticalIcon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-50">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={copyItem}>
                  {copied ? (
                    <HugeiconsIcon icon={Tick02Icon} />
                  ) : (
                    <HugeiconsIcon icon={Copy01Icon} />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </DropdownMenuItem>
                {item.normalizedUrl && (
                  <DropdownMenuItem onClick={onRefetch}>
                    <HugeiconsIcon icon={RefreshIcon} />
                    Refresh
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Move to collection
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="p-0">
                    <Command>
                      <CommandInput
                        placeholder="Filter collections..."
                        autoFocus={true}
                        className="h-7"
                      />
                      <CommandList>
                        <CommandEmpty>No collections found.</CommandEmpty>
                        <CommandGroup>
                          {collections.map((collection) => (
                            <CommandItem
                              key={collection.id}
                              value={collection.name}
                              onSelect={() => {
                                onMoveToCollection(collection.id);
                                setOpen(false);
                              }}
                            >
                              {collection.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <HugeiconsIcon icon={Delete02Icon} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }
);

BookmarkItem.displayName = "BookmarkItem";
