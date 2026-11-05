import { createFileRoute } from "@tanstack/react-router";

/** Read-only access to the refreshed KK7 copy: public map tiles and the manifest, nothing else. */
export const Route = createFileRoute("/api/public/kk7/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (path !== "manifest.json" && !/^12\/\d{1,4}\/\d{1,4}\.png$/.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("kk7-tiles").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": path.endsWith(".png") ? "image/png" : "application/json",
            "cache-control": path.endsWith(".png") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
          },
        });
      },
    },
  },
});
