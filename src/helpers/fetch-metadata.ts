import mql, { MicrolinkError } from "@microlink/mql";

export interface MetadataResult {
  success: boolean;
  title?: string;
  description?: string;
  fallback?: boolean;
  error?: string;
}

/**
 * Fetches metadata for a URL using Microlink mql
 * Falls back gracefully if service is unavailable
 *
 * @param url - Normalized URL to fetch metadata for
 * @returns Metadata including title, description
 */
export async function fetchMetadata(url: string): Promise<MetadataResult> {
  try {
    const { status, data: responseData } = await mql(url, {
      video: false,
      audio: false,
      palette: false,
      meta: true,
    });

    if (!responseData) {
      return {
        success: false,
        fallback: true,
        title: extractDomainAsTitle(url),
        description: url,
        error: `HTTP error: ${status}`,
      };
    }

    return {
      success: true,
      title: responseData.title ?? extractDomainAsTitle(url),
      description: responseData.description ?? "",
    };
  } catch (error: MicrolinkError | unknown) {
    if (error instanceof MicrolinkError) {
      return {
        success: false,
        fallback: true,
        title: extractDomainAsTitle(url),
        description: url,
        error: error.message,
      };
    }
    return {
      success: false,
      fallback: true,
      title: extractDomainAsTitle(url),
      description: url,
      error: "Unknown error",
    };
  }
}

/**
 * Batch fetch metadata for multiple URLs
 * Processes in parallel with concurrency limit
 *
 * @param urls - Array of normalized URLs
 * @param concurrency - Maximum parallel requests (default: 3)
 * @returns Array of metadata results in same order as input
 */
export async function batchFetchMetadata(
  urls: string[],
  concurrency: number = 3
): Promise<MetadataResult[]> {
  const results: MetadataResult[] = [];

  // Process in chunks
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);

    // Use allSettled to handle individual failures gracefully
    const chunkResults = await Promise.allSettled(
      chunk.map((url) => fetchMetadata(url))
    );

    chunkResults.forEach((result) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Fallback for rejected promises
        results.push({
          success: false,
          fallback: true,
          title: "Untitled",
          description: "unknown",
          error: result.reason?.message ?? "Unknown error",
        });
      }
    });

    // Small delay to avoid rate limiting
    if (i + concurrency < urls.length) {
      await sleep(300); // Reduced from 500ms for better UX
    }
  }

  return results;
}

/**
 * Extracts domain from URL to use as fallback title
 */
function extractDomainAsTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove 'www.' prefix if present
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "Untitled";
  }
}

/**
 * Simple sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for fetching metadata
 * Useful for handling transient failures
 *
 * @param url - URL to fetch
 * @param maxRetries - Maximum retry attempts (default: 2)
 * @returns Metadata result
 */
export async function fetchMetadataWithRetry(
  url: string,
  maxRetries: number = 2
): Promise<MetadataResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fetchMetadata(url);

    // Success if we got real metadata (not fallback)
    if (result.success && !result.fallback) {
      return result;
    }

    lastError = result.error;

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await sleep(Math.pow(2, attempt) * 800);
    }
  }

  // All retries failed, return fallback
  return {
    success: false,
    fallback: true,
    title: extractDomainAsTitle(url),
    description: url,
    error: lastError,
  };
}
