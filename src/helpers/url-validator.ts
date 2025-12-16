import { z } from "zod/v4";

/**
 * Patterns that indicate input is NOT a URL.
 * These are checked BEFORE any URL normalization to avoid false positives.
 */
const NON_URL_PATTERNS: RegExp[] = [
  /^#[0-9a-f]{3,8}$/i,
  /^[a-z-]+\s*\(/i,
  /^\d+(\.\d+)?\s+\d/,
  /^[\d.]+$/,
  /^\d+x\d+$/i,
  /^[\d.]+[a-z]{1,4}$/i,
];

/**
 * Quick check for patterns that look like URLs.
 * Returns true if it has URL-like characteristics.
 */
function looksLikeURL(input: string): boolean {
  const trimmed = input.trim();

  if (trimmed.length < 4) return false;

  if (/^https?:\/\//i.test(trimmed)) return true;

  if (/^www\./i.test(trimmed)) return true;

  if (!trimmed.includes(".")) return false;

  for (const pattern of NON_URL_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  return true;
}

const urlSchema = z
  .string()
  .transform((val) => {
    const url = val.trim();
    if (!url) return undefined;

    if (!looksLikeURL(url)) return undefined;

    if (!/^https?:\/\//i.test(url)) {
      return "https://" + url;
    }
    return url;
  })
  .refine(
    (val) => {
      if (!val) return false;
      try {
        const url = new URL(val);
        return url.hostname.includes(".");
      } catch {
        return false;
      }
    },
    { message: "Invalid URL" }
  );

export interface URLValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
}

/**
 * Validates and normalizes a URL.
 * Pre-rejects obvious non-URLs (colors, CSS functions) before transformation.
 *
 * @param input - Raw URL input (e.g., "example.com" or "https://example.com")
 * @returns Validation result with normalized URL if valid
 */
export function validateAndNormalizeURL(input: string): URLValidationResult {
  const result = urlSchema.safeParse(input);

  if (result.success && result.data) {
    return {
      isValid: true,
      normalizedUrl: result.data,
    };
  }

  return {
    isValid: false,
    error: "Invalid URL",
  };
}

/**
 * Extracts domain from URL for favicon fetching.
 *
 * @param url - Full URL
 * @returns Domain string or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Generates favicon URL from domain.
 * Uses Google's favicon service.
 *
 * @param url - Full URL
 * @returns Favicon URL
 */
export function getFaviconURL(url: string): string {
  const domain = extractDomain(url);
  if (!domain) {
    return "/placeholder-favicon.svg";
  }

  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
