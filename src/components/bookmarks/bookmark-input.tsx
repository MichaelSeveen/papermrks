import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import {
  hasMultipleItems,
  parseMultipleInputs,
  type ParsedItem,
} from "@/helpers/input-parser";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "../ui/input-group";
import { Button } from "../ui/button";

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

    // Check if paste contains multiple items (multiple lines)
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
    // Single line - let default paste behavior happen, user can press Enter
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
          placeholder="Add bookmark, color, or text • Press Enter to save • Paste multiple lines to bulk add"
          disabled={isProcessing}
        />
        <InputGroupAddon>
          <InputGroupText>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          {showAddButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={isProcessing}
            >
              {isProcessing ? "Adding..." : "Add"}
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
