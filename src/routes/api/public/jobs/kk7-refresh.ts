import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { refreshBatch, refreshVersion } from "@/game/kk7Refresh";
import { thermalTileUrl } from "@/game/thermalRaster";

/** Quarterly KK7 refresh: each scheduled run copies one small batch into private storage. */
export const Route = createFileRoute("/api/public/jobs/kk7-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const now = new Date();
        const batch = refreshBatch(now);
        if (!batch.tiles.length) return Response.json({ done: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let failed = 0;
        const uploads: Promise<unknown>[] = [];
        for (const tile of batch.tiles) {
          const started = Date.now();
          try {
            const response = await fetch(thermalTileUrl(tile.x, tile.y, "xcfly.lovable.app"));
            if (!response.ok) throw new Error(String(response.status));
            const body = await response.arrayBuffer();
            uploads.push(supabaseAdmin.storage.from("kk7-tiles").upload(`12/${tile.x}/${tile.y}.png`, body, { contentType: "image/png", upsert: true })
              .then(({ error }) => { if (error) failed++; }));
          } catch { failed++; }
          // Max 10 requests per second to the KK7 server.
          const wait = 100 - (Date.now() - started);
          if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        }
        await Promise.all(uploads);
        if (batch.last && !failed) {
          await supabaseAdmin.storage.from("kk7-tiles").upload("manifest.json", JSON.stringify({ version: refreshVersion(now) }), { contentType: "application/json", upsert: true });
        }
        return Response.json({ batch: batch.index, of: batch.batches, failed });
      },
    },
  },
});
