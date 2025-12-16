import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { slugify } from "./slugify";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

/**
 * Generates relevant tags for a bookmark using AI
 * Uses content, title, and URL to determine appropriate tags
 *
 * @param title - Bookmark title
 * @param description - Bookmark description
 * @param url - Bookmark URL
 * @returns Array of suggested tags (lowercase, slugified)
 */
export async function generateTags(
  title: string,
  description: string = "",
  url: string
): Promise<string[]> {
  try {
    const prompt = `Analyze this bookmark and suggest 2-6 relevant tags.
                    Title: ${title} 
                    URL: ${url}
                    ${description ? `Description: ${description}` : ""}
                    Return tags that are:
                  - Specific and relevant
                  - Lowercase
                  - Single words or short phrases (hyphenated)
                  - Useful for categorization
                    Examples: javascript, web-development, tutorial, ai, react`;

    const { text } = await generateText({
      model: google("gemini-2.5-pro"),
      prompt,
      temperature: 0.3,
    });

    const tags = extractTagsFromText(text);

    return [...new Set(tags.map(slugify))].slice(0, 5);
  } catch (error) {
    console.error("Error generating tags:", error);

    return [extractDomainTag(url)];
  }
}

/**
 * Generates a concise summary of bookmark content
 *
 * @param title - Bookmark title
 * @param content - Page content (will be truncated)
 * @returns 2-3 sentence summary
 */
export async function generateSummary(
  title: string,
  content: string
): Promise<string> {
  try {
    if (!content || content.length < 100) {
      return "";
    }

    const { text } = await generateText({
      model: google("gemini-2.5-pro"),
      prompt: `Summarize this article in 2-3 clear sentences.
               Title: ${title}
               Content: ${content.slice(0, 4000)}
               Provide a concise summary that captures the main points.`,
      temperature: 0.5,
    });

    return text.trim();
  } catch (error) {
    console.error("Error generating summary:", error);
    return "";
  }
}

/**
 * Finds similar bookmarks based on tags and content
 *
 * @param targetItem - The bookmark to find similar items for
 * @param allItems - Array of all user's bookmarks
 * @param limit - Maximum number of recommendations (default: 5)
 * @returns Array of similar bookmark IDs with scores
 */
export async function findSimilarBookmarks(
  targetItem: {
    id: string;
    title: string;
    description?: string;
    tags: string[];
  },
  allItems: Array<{
    id: string;
    title: string;
    description?: string;
    tags: string[];
  }>,
  limit: number = 5
): Promise<Array<{ itemId: string; score: number }>> {
  try {
    const similarities = allItems
      .filter((item) => item.id !== targetItem.id)
      .map((item) => {
        let score = 0;

        const commonTags = item.tags.filter((tag) =>
          targetItem.tags.includes(tag)
        ).length;
        score += commonTags * 0.4;

        const titleWords = new Set(targetItem.title.toLowerCase().split(/\s+/));
        const itemWords = item.title.toLowerCase().split(/\s+/);
        const commonWords = itemWords.filter(
          (word) => titleWords.has(word) && word.length > 3
        ).length;
        score += commonWords * 0.2;

        return {
          itemId: item.id,
          score: Math.min(score, 1),
        };
      })
      .filter((item) => item.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return similarities;
  } catch (error) {
    console.error("Error finding similar bookmarks:", error);
    return [];
  }
}

/**
 * Batch generate tags for multiple bookmarks
 * Processes sequentially to avoid rate limits
 *
 * @param items - Array of items to generate tags for
 * @returns Map of item ID to generated tags
 */
export async function batchGenerateTags(
  items: Array<{
    id: string;
    title: string;
    description?: string;
    url?: string;
    content?: string;
  }>
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  for (const item of items) {
    if (!item.url) {
      results.set(item.id, []);
      continue;
    }

    const tags = await generateTags(
      item.title,
      item.description || "",
      item.url
    );

    results.set(item.id, tags);

    // Small delay to respect rate limits
    await sleep(500);
  }

  return results;
}

/**
 * Extracts tags from AI response text
 * Handles various response formats
 */
function extractTagsFromText(text: string): string[] {
  // Remove markdown, bullets, numbers
  const cleaned = text
    .replace(/[*#-]/g, "")
    .replace(/\d+\./g, "")
    .toLowerCase();

  // Split by common separators
  const tags = cleaned
    .split(/[,\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length < 30);

  return tags;
}

function extractDomainTag(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return slugify(domain.split(".")[0] || "bookmark");
  } catch {
    return "bookmark";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
