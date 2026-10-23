import { useEffect, useRef, useState } from "react";
import { Download, Trash2, X } from "lucide-react";
import type { Site } from "@/game/sites";
import { offlineRegionUrls } from "@/game/offlineRegion";
import { deleteOfflineData, offlineEnabled, saveTile } from "@/lib/offline-data";
import { OFFLINE_KEY } from "@/lib/offline-policy";
import { syncOfflineWorker } from "@/lib/offline-worker";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";

export function OfflineSettings({ site }: { site: Site }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    setEnabled(offlineEnabled());
    const area = localStorage.getItem("xcfly-offline-area");
    if (area) {
      try { const saved = JSON.parse(area); setStatus(`${saved.name} · ${saved.mb} MB gespeichert`); } catch { /* Ignore outdated metadata. */ }
    }
    return () => abort.current?.abort();
  }, []);

  const download = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); setProgress(0); setStatus("");
    try {
      localStorage.setItem(OFFLINE_KEY, "true"); setEnabled(true);
      await navigator.storage?.persist?.();
      const appReady = await syncOfflineWorker(true);
      const urls = offlineRegionUrls(site, location.hostname);
      let next = 0, done = 0, bytes = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (next < urls.length) {
          controller.signal.throwIfAborted();
          const response = await saveTile(urls[next++], controller.signal);
          bytes += (await response.blob()).size;
          setProgress(Math.round(++done / urls.length * 100));
        }
      }));
      const mb = (bytes / 1024 / 1024).toFixed(1);
      localStorage.setItem("xcfly-offline-area", JSON.stringify({ ...site, mb }));
      setStatus(`${site.name} · ${mb} MB gespeichert.${appReady ? " Offline bereit." : " Offline-Appstart erst nach Veröffentlichung, nicht in der Vorschau."}`);
    } catch (error) {
      controller.abort();
      setStatus(error instanceof Error && error.name === "AbortError" ? "Download abgebrochen. Teildaten bleiben gespeichert." : `${error instanceof Error ? error.message : "Speichern fehlgeschlagen."} Erneut herunterladen, um fehlende Daten zu ergänzen.`);
    } finally { setBusy(false); abort.current = null; }
  };

  const toggle = async (value: boolean) => {
    if (value) { await download(); return; }
    localStorage.removeItem(OFFLINE_KEY); setEnabled(false);
    await syncOfflineWorker(false).catch(() => {});
    setStatus("Offline deaktiviert. Gespeicherte Daten bleiben erhalten.");
  };

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span>Offline verfügbar</span>
      <Switch checked={enabled} disabled={busy} onCheckedChange={(v) => void toggle(v)} aria-label="Offline verfügbar" />
    </div>
    <p className="text-[10px] leading-snug text-muted-foreground">{site.name} · Gelände, KK7-Thermik und Reliefkarte · 40 × 40 km. Offline-Karte bis Zoomstufe 12; weitere Gebiete, Kartenarten und Lufträume benötigen Internet.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void download()}><Download className="h-3 w-3" />{enabled ? "Gebiet speichern / ergänzen" : "Auf Gerät speichern"}</Button>
      {busy ? <Button size="icon" variant="outline" aria-label="Download abbrechen" title="Download abbrechen" onClick={() => abort.current?.abort()}><X /></Button> : <Button size="icon" variant="outline" aria-label="Offline-Daten löschen" title="Offline-Daten löschen" onClick={async () => { await toggle(false); await deleteOfflineData(); setStatus("Offline-Daten gelöscht."); }}><Trash2 /></Button>}
    </div>
    {busy && <div role="status" className="text-[11px] text-muted-foreground">Speichere Flugdaten… {progress} %<progress className="mt-1 h-2 w-full accent-primary" value={progress} max={100} /></div>}
    {status && <p role="status" className="text-[10px] leading-snug text-muted-foreground">{status}</p>}
  </div>;
}