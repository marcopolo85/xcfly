<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Full-region thermal coverage uses compressed per-tile PNGs, sparse byte heat arrays and a bounded visible-bitmap cache; never allocate a single country-sized canvas. Regional coverage is reused independently of moving terrain windows, with local mosaics beyond its bounds.
- Track overviews reuse the flight map tile renderer and launch-relative Mercator projection with its 55% vertical anchor; fit the full track and read the selected map style so summaries and ranking popups remain aligned with the flight map.
- Offline support is opt-in: generate the app-shell worker with vite-plugin-pwa, register only through offline-worker with preview guards, and persist CORS-readable regional tiles in a bounded Cache Storage cache; missing offline terrain/thermal coverage must fail or pause rather than fabricate data.
- Cache static contour paths in bounded, terrain-keyed world-space windows; transform them at draw time and recompute the exact flight-altitude contour each frame so performance improvements do not delay altitude feedback.
- Free launch selection uses the same inverse Mercator projection as the flight map and a single DEM tile to preview ground altitude; coordinate-specific site IDs isolate terrain/thermal caches. Flight terrain and KK7 coverage are prefetched as moving windows and swapped together, always using original launch-relative coordinates; pause before exhausting loaded coverage and retry failed loads to avoid fabricated terrain or lift on long flights.
- Simulation logic lives in src/game/* as pure TS (terrain, thermals, physics, sun, audio); React components only render and wire input — keeps the engine testable. No turnpoint/task feature: flights end on landing. The HUD "XC" distance is the XContest-style optimized free distance (max over downsampled track points of launch→point→current position, sim.xcDist), and XC speed is that distance divided by flight time.
- noUncheckedIndexedAccess is off: the engine does hot-loop typed-array indexing where per-access undefined checks add noise.
- Display the real relief using browser-loaded swisstopo colored relief WMTS tiles and pure launch-relative Mercator projection in src/game/swissMap.ts; tiles use the highest WMTS level that renders ≥256 device pixels per tile (reliefLevel, capped at 17) so the map stays sharp on high-dpi screens and when zoomed in. Flight terrain is loaded from open Terrarium DEM tiles in src/game/realTerrain.ts using the same projection, with procedural terrain only as offline fallback.
- Use independent d3-zoom canvas transforms for the map and heading-relative side profile; the profile samples existing simulation terrain and projects current vertical speed without affecting flight physics.
- Render real lake geometry (swisstopo `ch.bafu.vec25-seen`), major rivers (`ch.bafu.vec25-gewaessernetz_2000`) and forest geometry (swisstopo `ch.swisstopo.swisstlm3d-wald`) over the relief with cached alpha-preserving tints; apply semantic CSS relief filters only to base tiles so flight symbols, water and forests remain legible.
- Preprocess relief filters and lake tints once on native-resolution tile canvases, stored in a bounded least-recently-used browser cache keyed by URL and appearance; the animation loop only blits these surfaces to avoid repeated high-DPI filter work.
- Flight thermals sample the full KK7 thermal raster with the same launch-relative Mercator as terrain; render the unchanged provider colors and map the palette to climb rates for simulated lift: blue = 2 m/s, rising through cyan/green/yellow to dark red = 6 m/s. Keep dataset settings centralized in the pure thermalRaster module, load and cache mosaics in loadThermalRaster with bounded concurrency and memory, invert TMS tile rows, and send the actual site hostname as src. Missing data must show retry rather than invented sources; keep KK7 attribution and CC BY-NC-SA notice visible.
- The unfinished XC triangle (src/game/xcTriangle.ts) is optimized over ≤70 downsampled track points once per second; FAI = every leg ≥28% of perimeter, closing cylinder = 20% of perimeter around the first vertex, one FAI sector per leg (on the side of the opposite vertex, labelled with min/max reachable perimeter) drawn as a cached world-space Path2D.
