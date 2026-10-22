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
- Simulation logic lives in src/game/* as pure TS (terrain, thermals, physics, task, sun, audio); React components only render and wire input — keeps the engine testable.
- noUncheckedIndexedAccess is off: the engine does hot-loop typed-array indexing where per-access undefined checks add noise.
- Display the real relief using browser-loaded swisstopo WMTS tiles (national map with contours) and pure launch-relative Mercator projection in src/game/swissMap.ts; tiles use the highest WMTS level that renders ≥256 device pixels per tile (reliefLevel, capped at 17) so the map stays sharp on high-dpi screens and when zoomed in. Flight terrain is loaded from open Terrarium DEM tiles in src/game/realTerrain.ts using the same projection, with procedural terrain only as offline fallback.
- Use independent d3-zoom canvas transforms for the map and heading-relative side profile; the profile samples existing simulation terrain and projects current vertical speed without affecting flight physics.
- Flight thermal sources use the KK7 all-times GeoJSON hotspot feed in src/game/thermalHotspots.ts, projected with the same launch-relative Mercator as terrain; only strength/timing vary, never positions, and unavailable data must show retry rather than invented sources. Keep KK7 attribution and CC BY-NC-SA notice visible; the point API rejects src while raster requests require it.
