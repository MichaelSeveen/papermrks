import { validateAndNormalizeURL } from "./url-validator";
import { isValidColor, formatColor } from "./color-validator";

export type ParsedItemType = "url" | "color" | "text";

export interface ParsedItem {
  type: ParsedItemType;
  rawValue: string;
  processedValue: string;
}

/**
 * Parses multiple inputs from pasted text.
 * Uses newline-only splitting to preserve items with spaces (like color functions).
 *
 * @param text - Pasted text, potentially containing multiple items
 * @returns Array of classified items (url, color, or text)
 *
 * @example
 * ```
 * parseMultipleInputs(`
 *   https://google.com
 *   oklch(0.6 0.118 184.704)
 *   #FF5733
 *   My note with spaces
 * `)
 * // Returns:
 * // [
 * //   { type: "url", rawValue: "https://google.com", processedValue: "https://google.com" },
 * //   { type: "color", rawValue: "oklch(0.6 0.118 184.704)", processedValue: "hsl(...)" },
 * //   { type: "color", rawValue: "#FF5733", processedValue: "hsl(...)" },
 * //   { type: "text", rawValue: "My note with spaces", processedValue: "My note with spaces" }
 * // ]
 * ```
 */
export function parseMultipleInputs(text: string): ParsedItem[] {
  // Split by newlines only - preserves items with spaces
  const lines = text
    .split(/[\n\r]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const items: ParsedItem[] = [];

  for (const line of lines) {
    const classified = classifyInput(line);
    items.push(classified);
  }

  return items;
}

/**
 * Classifies a single input string as URL, color, or text.
 * Priority: Color > URL > Text (colors first to avoid URL encoding issues)
 */
export function classifyInput(input: string): ParsedItem {
  const trimmed = input.trim();

  // 1. Check if it's a valid color FIRST (before URL to avoid encoding issues)
  if (isValidColor(trimmed)) {
    const formatted = formatColor(trimmed);
    return {
      type: "color",
      rawValue: trimmed,
      processedValue: formatted || trimmed,
    };
  }

  // 2. Check if it's a valid URL
  const urlResult = validateAndNormalizeURL(trimmed);
  if (urlResult.isValid && urlResult.normalizedUrl) {
    return {
      type: "url",
      rawValue: trimmed,
      processedValue: urlResult.normalizedUrl,
    };
  }

  // 3. Default to text
  return {
    type: "text",
    rawValue: trimmed,
    processedValue: trimmed,
  };
}

/**
 * Checks if pasted text contains multiple items (more than one line).
 */
export function hasMultipleItems(text: string): boolean {
  const lines = text
    .split(/[\n\r]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.length > 1;
}
