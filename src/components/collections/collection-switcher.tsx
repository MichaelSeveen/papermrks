import { zodResolver } from "@hookform/resolvers/zod";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { LocalCollection } from "@/lib/dexie";
import {
  collectionSchema,
  type CollectionDataType,
} from "@/validations/collection.schema";
import { Button } from "../ui/button";
import {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxInput,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
} from "../ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Form } from "../ui/form";
import { Input } from "../ui/input";

interface CollectionSwitcherProps {
  collections: LocalCollection[];
  currentCollectionId: string | undefined;
  onSelectCollection: (collectionId: string | undefined) => void;
  onAddCollection: (
    name: string
  ) => Promise<{ success: boolean; collectionId?: string; error?: string }>;
}

export function CollectionSwitcher({
  collections,
  currentCollectionId,
  onSelectCollection,
  onAddCollection,
}: CollectionSwitcherProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const currentCollection = collections.find(
    (c) => c.id === currentCollectionId
  );

  return (
    <>
      <Combobox
        items={collections}
        value={currentCollection || null}
        onValueChange={(collection: LocalCollection | null) =>
          onSelectCollection(collection?.id ?? undefined)
        }
      >
        <ComboboxTrigger render={<Button variant="outline" />}>
          {currentCollection ? (
            <>
              <div
                className="size-4 rounded-full"
                style={{ backgroundColor: currentCollection.color }}
              />
              <span>{currentCollection.name}</span>
            </>
          ) : (
            <span>Select collection</span>
          )}
        </ComboboxTrigger>
        <ComboboxContent aria-label="Select collection">
          <ComboboxInput
            placeholder="Search collections..."
            showTrigger={false}
          />
          <ComboboxEmpty>No collections found.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxLabel>Collections</ComboboxLabel>
              <ComboboxCollection>
                {(collection: LocalCollection) => (
                  <ComboboxItem key={collection.id} value={collection}>
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: collection.color }}
                    />
                    {collection.name}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
            <ComboboxSeparator />
            <ComboboxItem
              render={
                <Button variant="ghost" onClick={() => setIsDialogOpen(true)} />
              }
            >
              <HugeiconsIcon icon={PlusSignIcon} />
              Create New
            </ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <CreateNewCollectionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onAddCollection={onAddCollection}
        onSelectCollection={onSelectCollection}
      />
    </>
  );
}

interface CreateNewCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCollection: (
    name: string
  ) => Promise<{ success: boolean; collectionId?: string; error?: string }>;
  onSelectCollection: (collectionId: string | undefined) => void;
}

function CreateNewCollectionDialog({
  open,
  onOpenChange,
  onAddCollection,
  onSelectCollection,
}: CreateNewCollectionDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CollectionDataType>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: "",
    },
  });

  const { isSubmitting } = form.formState;

  const handleFormSubmit = async (data: CollectionDataType) => {
    setServerError(null);

    const result = await onAddCollection(data.name);

    if (result.success) {
      // Auto-select the new collection
      if (result.collectionId) {
        onSelectCollection(result.collectionId);
      }
      onOpenChange(false);
      form.reset();
    } else {
      setServerError(result.error || "Failed to create collection");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setServerError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <Form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Collections help you organize your bookmarks
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Collection Name
                    <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id={field.name}
                    type="text"
                    placeholder="e.g Personal, Work, Articles etc"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError match={fieldState.invalid}>
                    {fieldState.error?.message}
                  </FieldError>
                </Field>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
