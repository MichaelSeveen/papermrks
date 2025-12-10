import {
  Combobox,
  ComboboxTrigger,
  ComboboxPopup,
  ComboboxList,
  ComboboxItem,
  ComboboxInput,
  ComboboxEmpty,
} from "../ui/combobox";
import { Button } from "../ui/button";
import { ChevronsUpDown } from "lucide-react";
import type { LocalCollection } from "@/lib/dexie";

interface CollectionSwitcherProps {
  collections: LocalCollection[];
  currentCollectionId: string | undefined;
  onSelectCollection: (collectionId: string | undefined) => void;
}

export function CollectionSwitcher({
  collections,
  currentCollectionId,
  onSelectCollection,
}: CollectionSwitcherProps) {
  // Add "All Bookmarks" option
  // const allOption = {
  //   id: undefined,
  //   name: "All Bookmarks",
  //   color: "#6B7280",
  // };

  // const options = [allOption, ...collections];
  const currentCollection = collections.find(
    (c) => c.id === currentCollectionId
  );

  return (
    <Combobox
      items={collections}
      value={currentCollection || null}
      onValueChange={(collection: LocalCollection | null) =>
        onSelectCollection(collection?.id ?? undefined)
      }
    >
      <ComboboxTrigger
        render={
          <Button
            className="w-full justify-between font-normal"
            variant="outline"
          />
        }
      >
        {currentCollection ? (
          <div className="flex items-center gap-2">
            <div
              className="size-4 rounded-full border border-border"
              style={{ backgroundColor: currentCollection.color }}
            />
            <span>{currentCollection.name}</span>
          </div>
        ) : (
          <span>Select collection</span>
        )}
        <ChevronsUpDown className="size-4 opacity-50" />
      </ComboboxTrigger>
      <ComboboxPopup aria-label="Select collection">
        <div className="border-b p-2">
          <ComboboxInput
            className="rounded-md"
            placeholder="Search collections..."
            showTrigger={false}
          />
        </div>
        <ComboboxEmpty>No collections found.</ComboboxEmpty>
        <ComboboxList>
          {(collection: LocalCollection) => (
            <ComboboxItem key={collection.id} value={collection}>
              <span
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: collection.color }}
              />
              {collection.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
