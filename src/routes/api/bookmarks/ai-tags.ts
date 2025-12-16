import { createFileRoute } from "@tanstack/react-router";
import { authenticationMiddleware } from "@/middleware/auth";
import { generateTags } from "@/lib/ai";
import { z } from "zod";

const AITagsRequestSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string().optional(),
});

export const Route = createFileRoute("/api/bookmarks/ai-tags")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        POST: {
          middleware: [authenticationMiddleware],
          handler: async ({ request, context }) => {
            if (!context.user) {
              return new Response("Unauthorized", { status: 401 });
            }

            try {
              const payload = await request.json();
              const parsed = AITagsRequestSchema.safeParse(payload);

              if (!parsed.success) {
                return new Response(
                  JSON.stringify({
                    error: "Invalid request",
                    details: parsed.error,
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }

              const { title, description, url } = parsed.data;

              // Generate tags
              const tags = await generateTags(title, description || "", url);

              return Response.json({
                success: true,
                tags,
              });
            } catch (error) {
              console.error("AI tags generation error:", error);
              return new Response(
                JSON.stringify({ error: "Failed to generate tags" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              );
            }
          },
        },
      }),
  },
});
