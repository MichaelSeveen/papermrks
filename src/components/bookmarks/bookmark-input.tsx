import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
  hasMultipleItems,
  parseMultipleInputs,
  type ParsedItem,
} from "@/helpers/input-parser";
import { Button } from "../ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { Spinner } from "../ui/spinner";

interface BookmarkInputProps {
  onAdd: (
    input: string,
    tags?: string[]
  ) => Promise<{ success: boolean; itemId?: string; error?: string }>;
  onAddMultiple: (items: ParsedItem[]) => Promise<{
    success: boolean;
    error?: string;
    addedCount?: number;
    totalCount?: number;
  }>;
  isProcessing?: boolean;
}

export function BookmarkInput({
  onAdd,
  onAddMultiple,
  isProcessing,
}: BookmarkInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (error) setError(null);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      await handleAdd();
    }
  };

  const handleAdd = async () => {
    if (!input.trim() || isProcessing) return;

    try {
      await onAdd(input.trim());
      setInput("");
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add");
      setTimeout(() => setError(null), 2000);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");

    if (hasMultipleItems(pastedText)) {
      e.preventDefault();

      try {
        const items = parseMultipleInputs(pastedText);
        await onAddMultiple(items);
        setInput("");
        setError(null);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to add multiple items"
        );
        setTimeout(() => setError(null), 2000);
      }
    }
  };

  const showAddButton = input.trim().length > 0;

  return (
    <div className="space-y-2">
      <InputGroup>
        <InputGroupInput
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Add link, color, or text • Insert multiple items to add at once..."
          disabled={isProcessing}
        />
        <InputGroupAddon>
          {isProcessing ? <Spinner /> : <HugeiconsIcon icon={PlusSignIcon} />}
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          {showAddButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={isProcessing}
            >
              Enter
            </Button>
          )}
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
