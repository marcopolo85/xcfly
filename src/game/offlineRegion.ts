import type { Site } from "./sites";
import { DEM_ZOOM, demTileUrl, localToPixel } from "./realTerrain";
import { THERMAL_ZOOM, thermalTileUrl } from "./thermalRaster";
import { EXTENT } from "./terrain";
import { reliefTileUrl, waterTileUrl, forestTileUrl, riverTileUrl } from "./swissMap";

/** Same launch-relative bounds as the real terrain and KK7 mosaics. */
export function offlineRegionUrls(site: Site, source: string) {
  const urls = new Set<string>();
  const add = (z: number, layers: ((x: number, y: number) => string)[]) => {
    const a = localToPixel(site, -EXTENT, EXTENT, z), b = localToPixel(site, EXTENT, -EXTENT, z);
    for (let y = Math.floor(a.py / 256); y <= Math.floor(b.py / 256); y++) {
      for (let x = Math.floor(a.px / 256); x <= Math.floor(b.px / 256); x++) {
        for (const layer of layers) urls.add(layer(x, y));
      }
    }
  };
  add(DEM_ZOOM, [(x, y) => demTileUrl(DEM_ZOOM, x, y)]);
  add(THERMAL_ZOOM, [(x, y) => thermalTileUrl(x, y, source)]);
  // Provider-friendly regional relief package; no bulk downloads from OSM/Topo.
  for (const z of [10, 11, 12]) add(z, [reliefTileUrl, waterTileUrl, forestTileUrl, riverTileUrl].map((layer) => (x: number, y: number) => layer(x, y, z)));
  return [...urls];
}