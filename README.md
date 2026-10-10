# musdi

> An interactive **3D map of Tamil Nadu** that shows **singers grouped by their
> birthplace district**, built entirely from pre-generated Wikidata / Wikipedia data.

musdi renders all **38 current districts** of Tamil Nadu as an extruded 3D relief
map. Hovering a district raises it and shows a count; selecting it opens a sheet of
the artists born there. Every artist, district and link is derived from a staged,
cached data pipeline — **no artist or district data is ever hand-invented or
fetched from the browser.**

The artist model is deliberately **category-agnostic**: v1 ships singers, but actors,
music directors, lyricists, dancers and directors can be added later without touching
the map engine.

---

## Quick start

```bash
bun install        # install dependencies (Bun only — do not use npm/pnpm/yarn)
bun run dev        # start the dev server at http://localhost:3000
```

The app reads static JSON from `public/data/` — committed to the repo — so it runs
with no network access and no build step for the data.

### Everyday commands

```bash
bun run dev         # next dev (Turbopack)
bun run build       # production build — MUST pass before shipping
bun run start       # serve the production build
bun run typecheck   # tsc --noEmit
bun run lint        # eslint (flat config)
bun test            # run all tests (bun:test)
bun run format      # prettier (no semicolons)
```

---

## Tech stack

| Area | Choice |
|---|---|
| Package manager | **Bun** (`bun.lock`) |
| Framework | **Next.js 16.4** (App Router, Turbopack) |
| UI library | **React 19.3** |
| Styling | **Tailwind v4** (CSS-first config in `app/globals.css`, no `tailwind.config.js`) |
| Components | **shadcn v4** (`base-nova`) built on **Base UI** — not Radix |
| 3D | **three** 0.186, **@react-three/fiber** 9, **@react-three/drei** 10 |
| Geo | **@turf** point-in-polygon |
| Validation | **zod** v4 |
| Tests | **bun:test** |

See [docs/](docs/) for the full engineering wiki, and [AGENTS.md](AGENTS.md) /
[CLAUDE.md](CLAUDE.md) for the product spec and the hard data-integrity rules.

---

## How it works

```
Wikidata / Wikipedia
      │  (scripts, cached under .cache/)
      ▼
  staged pipeline ── validate / normalize ──▶ public/data/*.json
                                                     │
                                                     ▼
                                      hooks/use-map-data ──▶ UI (3D map)
```

The browser **never** talks to Wikimedia. All harvesting, resolution and enrichment
happens offline in `scripts/`, and the committed JSON in `public/data/` is the only
thing the app loads.

Current data snapshot: **145 singers** across **38 districts** (134 with Wikipedia
pages, 86 with images, 0 awaiting review).

### Data pipeline

Each step caches its output so the pipeline is resumable:

```bash
bun run data:fetch      # candidate singers born in TN   -> .cache/pipeline/candidates.json
bun run data:resolve    # birthplace -> current district  -> resolved.json + data/review-needed.json
bun run data:enrich     # Wikipedia sitelinks + images    -> enriched.json
bun run data:generate   # merge                           -> public/data/artists.json + districts.json
bun run data:validate   # zod + referential-integrity check
bun run data:refresh    # fetch -> resolve -> enrich -> generate -> validate (full rebuild)
```

### Geo data

```bash
bun run geo:process     # download + simplify -> public/data/tamil-nadu-districts.geojson
bun run geo:validate    # fails unless exactly 38 canonical districts are present
```

---

## Project layout

```
app/           Next.js App Router (page, layout, error boundary, globals.css)
components/
  map/         3D map: Canvas, district meshes, DOM tooltip, loading states
  district/    district sheet + accessible district nav
  artist/      artist card + streaming icons
  search/      command-palette search over districts + singers
  ui/          shadcn (Base UI) components — regenerate via CLI
hooks/         use-map-data (loads the static JSON payloads)
lib/
  geo/         projection, normalizer, point-in-polygon, pure district resolver
  artists/     types, zod schemas, selectors (category-agnostic)
  wikimedia/   shared HTTP client (cache + rate-limit + retry) — scripts only
scripts/       data-generation (Bun only, never imported by the app)
data/          curated inputs: aliases, manual overrides, seeds, review-needed
public/data/   GENERATED static JSON the UI reads
.cache/        git-ignored raw downloads + pipeline intermediates
tests/         bun:test suites
```

---

## The non-negotiable rules

These come from [AGENTS.md](AGENTS.md) and are enforced:

1. **Never invent** artist or district data.
2. Group singers **primarily by birthplace district**. Unresolved ⇒
   `birthplaceDistrict: null` and the artist is sent to `data/review-needed.json`,
   never guessed onto the map.
3. **Native/hometown only when VERIFIED** via an explicit source — residence,
   workplace or place of death do not count.
4. **Current 38-district map only**; `geo:validate` must print `38/38`.
5. Wikipedia URLs come from **real sitelinks**, never guessed titles.
6. Images are **optional** — the UI must never fail when `imageUrl` is null.
7. Keep the engine **category-agnostic** (`Artist*`, not `Singer*`).
8. **No `any`.** Validate untrusted JSON with zod; don't cast.

---

## Before you ship

Run, in order, and make each pass:

```bash
bun run typecheck && bun run lint && bun test && bun run build
```

If you changed data, also run `bun run data:validate`. For 3D / interaction changes,
confirm the map visually with `bun run dev` — WebGL can't be fully covered by tests.

More detail lives in the [engineering wiki](docs/).
