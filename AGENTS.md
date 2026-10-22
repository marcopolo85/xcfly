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
- Display the real relief using browser-loaded swisstopo WMTS tiles (national map with contours) and pure launch-relative Mercator projection in src/game/swissMap.ts; keep map imagery independent from the simulated height field so presentation changes do not alter flight physics.
- Use independent d3-zoom canvas transforms for the map and heading-relative side profile; the profile samples existing simulation terrain and projects current vertical speed without affecting flight physics.
