/** Bounded, shared browser tile cache: overlapping flight windows reuse downloads. */
const tiles = new Map<string, Promise<HTMLImageElement>>();
export function loadRasterTile(url: string): Promise<HTMLImageElement> {
  const cached = tiles.get(url);
  if (cached) {
    tiles.delete(url); tiles.set(url, cached);
    return cached;
  }
  const tile = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timeout = setTimeout(() => reject(new Error("Kachel-Zeitüberschreitung")), 20000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error("Kachel nicht erreichbar")); };
    image.src = url;
  });
  tiles.set(url, tile);
  tile.catch(() => { if (tiles.get(url) === tile) tiles.delete(url); });
  if (tiles.size > 160) {
    const oldest = tiles.keys().next().value;
    if (oldest !== undefined) tiles.delete(oldest);
  }
  return tile;
}