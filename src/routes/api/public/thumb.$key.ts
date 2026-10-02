import { createFileRoute } from "@tanstack/react-router";
import { readThumb } from "@/lib/thumbnails.server";

export const Route = createFileRoute("/api/public/thumb/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const blob = await readThumb(params.key);
        if (!blob) return new Response("Not found", { status: 404 });
        return new Response(blob, {
          headers: {
            "content-type": blob.type || "image/jpeg",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
