import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Configure OpenRouter (cheaper than direct Anthropic)
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
 * @param content - Optional page content (truncated)
 * @returns Array of suggested tags (lowercase, slugified)
 */
export async function generateTags(
  title: string,
  description: string = "",
  url: string,
  content: string = ""
): Promise<string[]> {
  try {
    const prompt = `Analyze this bookmark and suggest 2-6 relevant tags.
                    Title: ${title} 
                    URL: ${url}
                    ${description ? `Description: ${description}` : ""}
                    ${content ? `Content preview: ${content.slice(0, 1000)}` : ""}
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

    // Parse tags from response (handle various formats)
    const tags = extractTagsFromText(text);

    // Return unique, slugified tags
    return [...new Set(tags.map(slugifyTag))].slice(0, 5);
  } catch (error) {
    console.error("Error generating tags:", error);
    // Fallback to domain-based tag
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
    // Simple similarity without AI (faster for MVP)
    const similarities = allItems
      .filter((item) => item.id !== targetItem.id)
      .map((item) => {
        let score = 0;

        // Tag overlap (weighted heavily)
        const commonTags = item.tags.filter((tag) =>
          targetItem.tags.includes(tag)
        ).length;
        score += commonTags * 0.4;

        // Title similarity (basic)
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
      item.url,
      item.content
    );

    results.set(item.id, tags);

    // Small delay to respect rate limits
    await sleep(500);
  }

  return results;
}

// Helper functions

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

/**
 * Converts tag to slug format
 * e.g., "Web Development" -> "web-development"
 */
export function slugifyTag(tag: string): string {
  return tag
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
/**
 * Extracts domain from URL as fallback tag
 */
function extractDomainTag(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return slugifyTag(domain.split(".")[0] || "bookmark");
  } catch {
    return "bookmark";
  }
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// const TagsSchema = z.object({
//   tags: z.array(z.string()).describe('Array of relevant tags (2-5 tags)')
// });

// const SummarySchema = z.object({
//   summary: z.string().describe('2-3 sentence summary of the content')
// });

// const RecommendationsSchema = z.object({
//   recommendations: z.array(z.object({
//     itemId: z.string(),
//     reason: z.string(),
//     score: z.number().min(0).max(1)
//   })).describe('Up to 5 related bookmarks with reasoning')
// });
