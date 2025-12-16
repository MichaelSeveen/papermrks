import { fetchMetadata } from "@/helpers/fetch-metadata";
import { validateAndNormalizeURL } from "@/helpers/url-validator";
import { authenticationMiddleware } from "@/middleware/auth";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MetadataRequestSchema = z.object({
  url: z.string(),
});

export const Route = createFileRoute("/api/bookmarks/metadata")({
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
              const parsed = MetadataRequestSchema.safeParse(payload);

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

              const { url } = parsed.data;

              // Validate URL
              const urlValidation = validateAndNormalizeURL(url);
              if (!urlValidation.isValid) {
                return new Response(
                  JSON.stringify({
                    error: "Invalid URL",
                    details: urlValidation.error,
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  }
                );
              }

              // Fetch metadata
              const metadata = await fetchMetadata(
                urlValidation.normalizedUrl!
              );

              return Response.json({
                success: metadata.success,
                title: metadata.title,
                description: metadata.description,
              });
            } catch (error) {
              console.error("Metadata fetch error:", error);
              return new Response(
                JSON.stringify({ error: "Failed to fetch metadata" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              );
            }
          },
        },
      }),
  },
});
