@AGENTS.md

---

# musdi — Agent Working Guide

`AGENTS.md` (imported above) is the original product spec and the hard data-integrity
rules. **Those rules always win.** This file is the practical "how to work in this
repo" guide: stack facts, gotchas, architecture, and recipes for common changes.

> musdi = an interactive 3D map of Tamil Nadu that shows **singers** grouped by their
> **birthplace district**, built from pre-generated Wikidata/Wikipedia data. The
> artist model is category-agnostic so future phases can add actors, music directors,
> lyricists, dancers, directors without touching the map engine.

## Stack (verify, don't assume — these are newer than most training data)

| Thing | Value | Why it matters |
|---|---|---|
| Package manager | **Bun** (`bun.lock`) | Use `bun` / `bunx`. Never introduce npm/pnpm/yarn lockfiles. |
| Framework | **Next.js 16.4** (App Router, Turbopack) | Breaking changes vs. older Next. Read `node_modules/next/dist/docs/` before framework-level work. `error.tsx` uses `retry` (not `reset`). `ssr:false` dynamic imports are **only** allowed inside Client Components. |
| React | **19.3** | R3F peer range is `>=19 <19.4`. Don't bump React past 19.3 without checking `@react-three/fiber`. |
| Styling | **Tailwind v4** | CSS-first config in `app/globals.css` (`@import "tailwindcss"`). There is **no** `tailwind.config.js`. Theme tokens are CSS vars (OKLCH), light + `.dark`. |
| UI kit | **shadcn v4, style `base-nova`, built on `@base-ui/react` — NOT Radix** | Add components with `bunx --bun shadcn@latest add <name>`. Base UI APIs differ from Radix: Dialog/Sheet use `open` / `onOpenChange`; triggers use `render={<Button/>}`. Don't hand-write Radix components. |
| `cn` | from the `cn` package | `import { cn } from "cn"` (or `@/lib/utils`), not clsx+twMerge. |
| Icons | `lucide-react` | |
| 3D | `three` 0.186, `@react-three/fiber` 9, `@react-three/drei` 10 | |
| Validation | `zod` v4 | `z.string().url()` works; schemas live in `lib/artists/schemas.ts`. |
| Geo | `@turf/boolean-point-in-polygon`, `@turf/helpers` | point-in-polygon district resolution. |
| Tests | **`bun test`** (bun:test) | No Jest/Vitest. Tests in `tests/`. |
| Formatting | Prettier, **no semicolons** (`.prettierrc`) | Match existing style. |

## Commands

```bash
bun run dev            # next dev
bun run build          # next build (MUST pass before claiming done)
bun run typecheck      # tsc --noEmit
bun run lint           # eslint (flat config; react-hooks immutability rules are strict)
bun test               # all tests in tests/

# Geo data (one-time / when district map changes)
bun run geo:process    # download + simplify + normalize -> public/data/tamil-nadu-districts.geojson
bun run geo:validate   # fails unless exactly 38 canonical districts present

# Artist data pipeline (staged; each step caches so it's resumable)
bun run data:fetch     # STEP 1-3: candidate singers born in TN  -> .cache/pipeline/candidates.json
bun run data:resolve   # STEP 6:  birthplace -> current district -> .cache/pipeline/resolved.json + data/review-needed.json
bun run data:enrich    # STEP 4-5: Wikipedia sitelinks + images  -> .cache/pipeline/enriched.json
bun run data:generate  # STEP 7:  merge -> public/data/artists.json + districts.json
bun run data:validate  # zod + referential-integrity check of generated data
bun run data:refresh   # fetch -> resolve -> enrich -> generate -> validate (full rebuild)

# Add the --force flag to any pipeline script to bypass the HTTP cache.
```

## Architecture

```
app/
  page.tsx            Server Component; renders <ArtistMap/> full-bleed
  layout.tsx          fonts + ThemeProvider (dark/light, "d" hotkey)
  error.tsx           route error boundary (Client Component, uses `retry`)
  globals.css         Tailwind v4 config + theme tokens

components/
  map/
    artist-map.tsx    Client orchestrator: data load, hover/select state, tooltip
                      close-intent logic, dynamic ssr:false import of the scene.
    map-scene.tsx     The <Canvas>: ortho camera, Bounds auto-fit, lights,
                      OrbitControls (constrained), one DistrictMesh per feature.
                      Group is rotated -90° on X so extrusion reads as relief.
    district-mesh.tsx One district. Memoized geometry/material; useFrame lerps
                      elevation + colour toward a prop-driven target.
    district-tooltip.tsx  DOM (not WebGL) hover card; viewport-clamped; hoverable.
    map-loading.tsx   skeleton + error states
  district/
    district-sheet.tsx  shadcn Sheet with ArtistCards for the selected district
    district-nav.tsx    accessible (keyboard/SR) list of all 38 districts
  artist/artist-card.tsx  image, name, badges, birthplace, VERIFIED native place, links
  search/map-search.tsx   shadcn Command search over districts + singers
  ui/                 shadcn components (Base UI) — regenerate via CLI, don't hand-edit heavily

hooks/use-map-data.ts   loads the 3 static JSON payloads from /data with error states

lib/
  geo/
    district-normalizer.ts  CANONICAL_DISTRICTS (38) + normalizeDistrictName() + aliases
    projection.ts           equirectangular projection centered on TN bbox, origin-centered
    geojson-to-three.ts     GeoJSON -> THREE.Shape -> ExtrudeGeometry (bevel OFF)
    point-in-district.ts     turf point-in-polygon resolver
    resolve-district.ts      PURE strategy-precedence resolver (unit tested)
    types.ts                 GeoJSON feature types
  artists/
    types.ts            Artist / District / ArtistDataset model (category-agnostic)
    selectors.ts        buildDistricts(), indexArtists(), artistsForDistrict(), searchAll()
    schemas.ts          zod schemas for generated data
  wikimedia/client.ts   shared HTTP: cache + rate-limit + retry/backoff + UA (scripts only)

scripts/                data-generation scripts (run with bun; Node/Bun only, never imported by the app)
data/
  district-aliases.json   alt spelling -> canonical
  manual-overrides.json   reviewed corrections (birthplaceDistrict / native place) keyed by QID
  review-needed.json      GENERATED: candidates that couldn't be safely resolved
public/data/              GENERATED static JSON the UI reads (geojson, artists.json, districts.json)
.cache/                   git-ignored: raw downloads + per-request HTTP cache + pipeline intermediates
```

### Data flow (never fetch Wikimedia from the browser)

```
Wikidata/Wikipedia -> scripts (cache in .cache/) -> validate/normalize
                   -> public/data/*.json -> hooks/use-map-data -> UI
```

## Hard rules (from AGENTS.md — enforced, do not relax)

1. **Never invent artist or district data.** No hard-coded "famous singers" list as final data.
2. **Group singers PRIMARILY by birthplace district.** An artist with an unresolved
   district gets `birthplaceDistrict: null` and is **not** placed in any district — it
   goes to `data/review-needed.json`. Never guess a district.
3. **Native/hometown only when VERIFIED** via an explicit source (manual override).
   Residence, workplace, career city, place of death are **not** native place.
4. **Current 38-district map only.** `geo:validate` must pass; reject a 32-district map.
5. Wikipedia URLs come from **real sitelinks** (en preferred, then ta), never guessed titles.
6. Images are **optional** — UI must never fail when `imageUrl` is null.
7. Keep the engine category-agnostic: name things `Artist*`, not `Singer*`. v1 filters `category.includes("singer")`.
8. No `any`. External/API JSON is untrusted — validate with zod, don't cast.

## Gotchas learned the hard way

- **R3F + react-hooks immutability lint:** you may NOT mutate a `useMemo`'d object
  inside `useFrame`. Read the material off the mesh **ref** (`mesh.material`) and mutate
  that. See `district-mesh.tsx`. Do state-driven targets; interpolate in the frame loop;
  never call `setState` per frame.
- **WDQS SPARQL times out** on a single big query. The working pattern (see
  `fetch-artists.ts`): fetch singer subclasses first, then query people in **small
  occupation batches**, and **adaptively split** a heavy batch in half down to a single
  occupation. Batch queries use `{ retryServerErrors: false }` so a 504/timeout fails
  fast and triggers a split instead of burning retries.
- **WDQS rate-limits aggressively (HTTP 429).** The client honours `Retry-After` and
  spaces requests per host. Don't hammer it with ad-hoc probes — it throttles the whole
  session. Everything is cached under `.cache/`, so re-runs are cheap.
- **Projection:** latitude -> +Y (north up). The scene group is rotated `-PI/2` on X so
  the XY-plane map lies flat and extrusion (+Z local) becomes world +Y. Elevation is the
  mesh's local `position.z`.
- **GeoJSON simplification is per-polygon** (Douglas–Peucker). Tiny gaps between
  districts are intentional ("subtle district separation") — don't "fix" them with
  topology merging.

## Recipes

- **Refresh the singer data:** `bun run data:refresh`. Review `data/review-needed.json`;
  for anything fixable, add a **reviewed** entry (with `reason` + `source`) to
  `data/manual-overrides.json`, then re-run `data:resolve` → `data:generate` → `data:validate`.
- **Add a specific singer the harvest misses** (e.g. famous artist absent from the
  map): the SPARQL harvest only finds people whose Wikidata occupation (`P106`) is
  singer/a subclass **and** whose place of birth (`P19`) is within Tamil Nadu — so
  someone tagged only "songwriter"/"actor", or with no `P19`, is silently skipped.
  Don't relax the query. Instead verify the person against Wikidata (genuine singer,
  **born in Tamil Nadu** — rule 2), add their QID to `data/seed-artists.json` (with a
  `reason` + `source`); `fetch-artists.ts` force-includes seeds, pulling name/
  birthplace/sitelinks/image from Wikidata. If their birthplace can't resolve to a
  district (no `P19`, or `P19` is only the state), add a **reviewed, cited** override to
  `data/manual-overrides.json`. Then `bun run data:refresh`. Never seed someone born
  outside Tamil Nadu.
- **Add a new artist category (e.g. actors):** add the occupation QID logic in
  `scripts/fetch-artists.ts` (new query or category tag), set `category` accordingly in
  `scripts/generate-data.ts`, extend `ArtistCategory` in `lib/artists/types.ts` +
  `schemas.ts`. The map engine, selectors, Sheet and search need **no** changes.
- **Update the district map / add an alias:** edit `data/district-aliases.json` or the
  source URL in `scripts/process-geojson.ts`, run `geo:process` then `geo:validate`
  (must print `38/38`). Add a normalizer test in `tests/district-normalizer.test.ts`.
- **Add a shadcn component:** `bunx --bun shadcn@latest add <name>` (it's Base UI).
- **Fix a mis-resolved birthplace:** prefer a manual override (rule 3 style) over
  touching resolver code. The resolver precedence lives in `lib/geo/resolve-district.ts`
  and is unit-tested — if you change it, update `tests/resolve-district.test.ts`.

## Before saying "done"

Run and pass, in this order: `bun run typecheck` → `bun run lint` → `bun test` →
`bun run build`. The production build passing is the bar. If you changed data, also run
`bun run data:validate`. Visually confirm the map in `bun run dev` for 3D/interaction
changes (WebGL can't be fully checked by tests).
