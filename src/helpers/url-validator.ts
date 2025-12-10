import { z } from "zod/v4";

// Comprehensive URL validation schema
// leniently accepts domains with TLDs (e.g. "awwwards.com", "google.co.uk")
const urlSchema = z
  .string()
  .transform((val) => {
    let url = val.trim();
    if (!url) return undefined;

    // Add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    return url;
  })
  .refine(
    (val) => {
      if (!val) return false;
      try {
        const url = new URL(val);
        // Basic check for dot in hostname to avoid treating single words as URLs
        return url.hostname.includes(".") && val.length > 3;
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
 * Validates and normalizes a URL
 * Handles URLs with or without protocol (http://, https://)
 *
 * @param input - Raw URL input (e.g., "example.com" or "https://example.com")
 * @returns Validation result with normalized URL if valid
 */
export function validateAndNormalizeURL(input: string): URLValidationResult {
  const result = urlSchema.safeParse(input);

  if (result.success) {
    return {
      isValid: true,
      normalizedUrl: result.data,
    };
  }

  return {
    isValid: false,
    error: result.error.message || "Invalid URL",
  };
}

/**
 * Extracts and validates multiple URLs from pasted text
 * Handles newlines, spaces, and mixed content
 *
 * @param text - Pasted text potentially containing URLs
 * @returns Array of validated and normalized URLs
 */
export function extractURLsFromText(text: string): string[] {
  // Split by common delimiters
  const potentialUrls = text
    .split(/[\n\r\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const validUrls: string[] = [];

  for (const input of potentialUrls) {
    const result = validateAndNormalizeURL(input);
    if (result.isValid && result.normalizedUrl) {
      validUrls.push(result.normalizedUrl);
    }
  }

  return validUrls;
}

/**
 * Extracts domain from URL for favicon fetching
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
 * Generates favicon URL from domain
 * Uses Google's favicon service as fallback
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
