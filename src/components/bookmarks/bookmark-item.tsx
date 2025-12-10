import type { LocalItem, LocalCollection } from "@/lib/dexie";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../ui/item";
import { Icon } from "@iconify/react";
import { Menu, MenuItem, MenuPopup, MenuSub, MenuTrigger } from "../ui/menu";
import { Link } from "@tanstack/react-router";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";

interface BookmarkItemProps {
  item: LocalItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onRefetch: () => void;
  collections: LocalCollection[];
  onMoveToCollection: (collectionId: string) => void;
}

export function BookmarkItem({
  item,
  isSelected,
  onToggleSelect,
  onDelete,
  onRefetch,
  collections,
  onMoveToCollection,
}: BookmarkItemProps) {
  const renderContent = () => {
    if (item.type === "COLOR") {
      return (
        <Item
          variant="outline"
          className={cn(
            "hover:bg-accent/50 transition-colors",
            isSelected && "bg-accent"
          )}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="shrink-0"
          />
          <ItemMedia>
            <div
              className="size-8 rounded-full"
              style={{ backgroundColor: item.colorValue }}
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {item.colorValue}
              {item.syncStatus === "pending" && (
                <Badge variant="warning">Pending sync</Badge>
              )}
              {item.syncStatus === "syncing" && (
                <Badge variant="secondary">Syncing...</Badge>
              )}
              {item.syncStatus === "error" && (
                <Badge variant="destructive">Sync error</Badge>
              )}
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <Menu>
              <MenuTrigger openOnHover render={<Button variant="outline" />}>
                <Icon icon="solar:menu-dots-bold-duotone" rotate={90} />
              </MenuTrigger>
              <MenuPopup>
                <MenuItem onClick={onDelete}>
                  <Icon icon="solar:trash-bold-duotone" />
                  Delete
                </MenuItem>
                <MenuSub>
                  <MenuTrigger>
                    <Icon icon="solar:rewind-forward-bold-duotone" />
                    Move to
                  </MenuTrigger>
                  <MenuPopup className="p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search collections..."
                        autoFocus={true}
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No collections found.</CommandEmpty>
                        <CommandGroup>
                          {collections.map((collection) => (
                            <CommandItem
                              key={collection.id}
                              value={collection.name}
                              onSelect={() => {
                                if (collection.id !== item.collectionId) {
                                  onMoveToCollection(collection.id);
                                }
                              }}
                              disabled={collection.id === item.collectionId}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="size-3 rounded-full border border-border"
                                  style={{ backgroundColor: collection.color }}
                                />
                                <span>{collection.name}</span>
                                {collection.id === item.collectionId && (
                                  <Icon
                                    icon="solar:check-circle-bold"
                                    className="ml-auto size-4 text-primary"
                                  />
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </MenuPopup>
                </MenuSub>
              </MenuPopup>
            </Menu>
          </ItemActions>
        </Item>
      );
    }

    if (item.type === "TEXT") {
      return (
        <Item
          variant="outline"
          className={cn(
            "hover:bg-accent/50 transition-colors",
            isSelected && "bg-accent"
          )}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="shrink-0"
          />
          <ItemMedia>
            <Icon icon="solar:text-circle-bold-duotone" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {item.title}
              {item.syncStatus === "pending" && (
                <Badge variant="warning">Pending sync</Badge>
              )}
              {item.syncStatus === "syncing" && (
                <Badge variant="secondary">Syncing...</Badge>
              )}
              {item.syncStatus === "error" && (
                <Badge variant="destructive">Sync error</Badge>
              )}
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <Menu>
              <MenuTrigger openOnHover render={<Button variant="outline" />}>
                <Icon icon="solar:menu-dots-bold-duotone" rotate={90} />
              </MenuTrigger>
              <MenuPopup>
                <MenuItem onClick={onDelete}>
                  <Icon icon="solar:trash-bold-duotone" />
                  Delete
                </MenuItem>
                <MenuSub>
                  <MenuTrigger>
                    <Icon icon="solar:rewind-forward-bold-duotone" />
                    Move to
                  </MenuTrigger>
                  <MenuPopup className="p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search collections..."
                        autoFocus={true}
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No collections found.</CommandEmpty>
                        <CommandGroup>
                          {collections.map((collection) => (
                            <CommandItem
                              key={collection.id}
                              value={collection.name}
                              onSelect={() => {
                                if (collection.id !== item.collectionId) {
                                  onMoveToCollection(collection.id);
                                }
                              }}
                              disabled={collection.id === item.collectionId}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="size-3 rounded-full border border-border"
                                  style={{ backgroundColor: collection.color }}
                                />
                                <span>{collection.name}</span>
                                {collection.id === item.collectionId && (
                                  <Icon
                                    icon="solar:check-circle-bold"
                                    className="ml-auto size-4 text-primary"
                                  />
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </MenuPopup>
                </MenuSub>
              </MenuPopup>
            </Menu>
          </ItemActions>
        </Item>
      );
    }

    // BOOKMARK type
    return (
      <Item
        variant="outline"
        className={cn(
          "hover:bg-accent/50 transition-colors",
          isSelected && "bg-accent"
        )}
      >
        <ItemMedia>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="shrink-0"
          />
          {item.favicon ? (
            <img
              src={item.favicon}
              alt={`${item.title} favicon`}
              className="size-8 rounded shrink-0 mt-1"
            />
          ) : (
            <Icon icon="solar:global-line-duotone" />
          )}
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {item.title}
            {item.syncStatus === "pending" && (
              <Badge variant="warning">Pending sync</Badge>
            )}
            {item.syncStatus === "syncing" && (
              <Badge variant="secondary">Syncing...</Badge>
            )}
            {item.syncStatus === "error" && (
              <Badge variant="destructive">Sync error</Badge>
            )}
          </ItemTitle>
          {item.url && (
            <ItemDescription>
              <Link to={item.url}>{new URL(item.url).hostname}</Link>
            </ItemDescription>
          )}
        </ItemContent>
        <ItemActions>
          <Menu>
            <MenuTrigger openOnHover render={<Button variant="outline" />}>
              <Icon icon="solar:menu-dots-bold-duotone" rotate={90} />
            </MenuTrigger>
            <MenuPopup>
              <MenuItem onClick={onDelete}>
                <Icon icon="solar:trash-bold-duotone" />
                Delete
              </MenuItem>
              <MenuSub>
                <MenuTrigger>
                  <Icon icon="solar:rewind-forward-bold-duotone" />
                  Move to
                </MenuTrigger>
                <MenuPopup className="p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search collections..."
                      autoFocus={true}
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>No collections found.</CommandEmpty>
                      <CommandGroup>
                        {collections.map((collection) => (
                          <CommandItem
                            key={collection.id}
                            value={collection.name}
                            onSelect={() => {
                              if (collection.id !== item.collectionId) {
                                onMoveToCollection(collection.id);
                              }
                            }}
                            disabled={collection.id === item.collectionId}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="size-3 rounded-full border border-border"
                                style={{ backgroundColor: collection.color }}
                              />
                              <span>{collection.name}</span>
                              {collection.id === item.collectionId && (
                                <Icon
                                  icon="solar:check-circle-bold"
                                  className="ml-auto size-4 text-primary"
                                />
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </MenuPopup>
              </MenuSub>
              <MenuItem onClick={onRefetch}>
                <Icon icon="solar:refresh-bold-duotone" />
                Re-fetch
              </MenuItem>
            </MenuPopup>
          </Menu>
        </ItemActions>
      </Item>
    );
  };

  return renderContent();
}
