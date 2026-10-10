# Architecture

musdi is a Next.js 16 (App Router) app that renders a 3D map from static JSON. There
are two cleanly separated worlds:

- **Offline / build-time** — `scripts/` harvest and process Wikidata/Wikipedia data
  into `public/data/*.json`. These run under Bun and are **never** imported by the app.
- **Runtime / browser** — the App Router UI loads only the committed JSON. It never
  talks to Wikimedia.

```text
Wikidata / Wikipedia
      │  scripts/ (cached in .cache/)
      ▼
  validate / normalize ──▶ public/data/{artists,districts}.json
                           public/data/tamil-nadu-districts.geojson
                                         │
                                         ▼
                           hooks/use-map-data ──▶ components/map ──▶ WebGL
```

## Runtime flow

1. [`app/page.tsx`](../app/page.tsx) is a Server Component that renders the full-bleed
   `<ArtistMap/>`. [`app/layout.tsx`](../app/layout.tsx) sets up fonts and the
   theme provider (dark/light, `d` hotkey). [`app/error.tsx`](../app/error.tsx) is the
   route error boundary (a Client Component — note Next 16 uses `retry`, not `reset`).
2. [`components/map/artist-map.tsx`](../components/map/artist-map.tsx) is the client
   orchestrator. It loads data, owns hover/select state and tooltip close-intent logic,
   and **dynamically imports the scene with `ssr: false`** (only allowed inside a
   Client Component in Next 16).
3. [`hooks/use-map-data.ts`](../hooks/use-map-data.ts) fetches the three static JSON
   payloads from `/data` and exposes loading/error states.
4. [`components/map/map-scene.tsx`](../components/map/map-scene.tsx) is the `<Canvas>`:
   orthographic camera, `Bounds` auto-fit, lights, constrained `OrbitControls`, and one
   `DistrictMesh` per feature. The whole group is rotated `-90°` on X so the extrusion
   reads as vertical relief.
5. [`components/map/district-mesh.tsx`](../components/map/district-mesh.tsx) is a single
   district — memoized geometry/material whose elevation and colour are lerped toward a
   prop-driven target in `useFrame`.

See [rendering.md](rendering.md) for the 3D details.

## UI surfaces

- **District sheet** — [`components/district/district-sheet.tsx`](../components/district/district-sheet.tsx)
  shows `ArtistCard`s for the selected district (shadcn `Sheet`, Base UI `open` /
  `onOpenChange`).
- **District nav** — [`components/district/district-nav.tsx`](../components/district/district-nav.tsx)
  is a keyboard/screen-reader-accessible list of all 38 districts.
- **Search** — [`components/search/map-search.tsx`](../components/search/map-search.tsx)
  is a shadcn `Command` palette over districts + singers.
- **Artist card** — [`components/artist/artist-card.tsx`](../components/artist/artist-card.tsx)
  renders image, name, badges, birthplace, verified native place and links; must degrade
  gracefully when `imageUrl` is null.

## Library layer

- [`lib/geo/`](../lib/geo/) — `projection.ts` (equirectangular, TN-centered),
  `district-normalizer.ts` (38 canonical names + aliases), `geojson-to-three.ts`
  (GeoJSON → `ExtrudeGeometry`), `point-in-district.ts` (turf resolver) and
  `resolve-district.ts` (the **pure, unit-tested** strategy-precedence resolver).
- [`lib/artists/`](../lib/artists/) — `types.ts` (the category-agnostic model),
  `schemas.ts` (zod) and `selectors.ts` (`buildDistricts`, `indexArtists`,
  `artistsForDistrict`, `searchAll`).
- [`lib/wikimedia/client.ts`](../lib/wikimedia/client.ts) — shared HTTP client with
  caching, per-host rate-limiting, retry/backoff and a UA. **Scripts only.**

## Why the split matters

Keeping Wikimedia access entirely in `scripts/` means the app is deterministic,
offline-capable and fast, and the data-integrity rules can be enforced once at
generation time rather than being re-checked in the browser.
