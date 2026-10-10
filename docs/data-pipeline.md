# Data pipeline

All artist and district data is produced offline by scripts under [`scripts/`](../scripts/)
and committed as static JSON in [`public/data/`](../public/data/). The browser never
fetches Wikimedia. Each stage caches its output under `.cache/` (git-ignored), so the
pipeline is **resumable** and re-runs are cheap.

## Stages

| Step | Script | Command | Output |
|------|--------|---------|--------|
| 1–3 Harvest | `fetch-artists.ts` | `bun run data:fetch` | `.cache/pipeline/candidates.json` |
| 6 Resolve | `resolve-districts.ts` | `bun run data:resolve` | `.cache/pipeline/resolved.json` + `data/review-needed.json` |
| 4–5 Enrich | `enrich-artists.ts` | `bun run data:enrich` | `.cache/pipeline/enriched.json` |
| 7 Generate | `generate-data.ts` | `bun run data:generate` | `public/data/artists.json` + `districts.json` |
| Validate | `validate-artists.ts` | `bun run data:validate` | zod + referential-integrity check |

Full rebuild: `bun run data:refresh` (fetch → resolve → enrich → generate → validate).
Add `--force` to any step to bypass the HTTP cache.

## 1. Harvest — `fetch-artists.ts`

Finds people on Wikidata whose occupation (`P106`) is singer (or a subclass) **and**
whose place of birth (`P19`) is within Tamil Nadu.

WDQS (the Wikidata Query Service) **times out on a single large query**, so the working
pattern is:

- fetch singer subclasses first,
- query people in **small occupation batches**, and
- **adaptively split** a heavy batch in half, down to a single occupation.

Batch queries use `{ retryServerErrors: false }` so a 504/timeout fails fast and
triggers a split instead of burning retries. WDQS also rate-limits aggressively (HTTP
429); the shared client honours `Retry-After` and spaces requests per host — don't
hammer it with ad-hoc probes.

**Seeds:** QIDs listed in [`data/seed-artists.json`](../data/seed-artists.json) are
force-included (name/birthplace/sitelinks/image pulled from Wikidata). Use this only for
genuine singers **born in Tamil Nadu** that the query misses (e.g. someone tagged only
"songwriter"). Never seed someone born outside Tamil Nadu.

## 2. Resolve — `resolve-districts.ts`

Maps each birthplace to a **current** district using the pure, precedence-ordered
resolver in [`lib/geo/resolve-district.ts`](../lib/geo/resolve-district.ts). Strategies
(see `DistrictResolutionMethod`): Wikidata administrative hierarchy → geo
point-in-polygon → place mapping → manual override.

Anything that can't be resolved safely gets `birthplaceDistrict: null` and is written to
[`data/review-needed.json`](../data/review-needed.json) — **never guessed onto the map**.

**Manual overrides:** reviewed, cited corrections live in
[`data/manual-overrides.json`](../data/manual-overrides.json), keyed by QID, each with a
`reason` and `source`. This is the preferred fix for a mis-resolved birthplace or a
verified native place — don't patch resolver code for one-off cases.

## 3. Enrich — `enrich-artists.ts`

Adds Wikipedia sitelinks (en preferred, then ta — **real sitelinks only**, never guessed
titles), images, and streaming identifiers (Spotify `P1902`, Apple Music `P2850`). All
of these are optional; a null means Wikidata has no such claim and the UI must still
render.

## 4. Generate — `generate-data.ts`

Merges everything into the two payloads the UI reads:

- `public/data/artists.json` — an `ArtistDataset` (see [data-model.md](data-model.md)).
- `public/data/districts.json` — the 38 districts, each referencing artist ids.

## 5. Validate — `validate-artists.ts`

Parses the generated JSON with the zod schemas in
[`lib/artists/schemas.ts`](../lib/artists/schemas.ts) and checks referential integrity
(every district's artist ids resolve, categories are valid, etc.).

## Current snapshot

145 singers, 38 districts, 134 with Wikipedia, 86 with images, 0 awaiting review
(`stats` in `public/data/artists.json`).

## Geo data

Separate from the artist pipeline:

```bash
bun run geo:process    # download + simplify (Douglas–Peucker) -> public/data/tamil-nadu-districts.geojson
bun run geo:validate   # fails unless exactly 38 canonical districts are present (prints 38/38)
```

Simplification is **per-polygon**, so tiny gaps between districts are intentional
("subtle district separation") — don't fix them with topology merging. To add an alias
or change the source map, edit [`data/district-aliases.json`](../data/district-aliases.json)
or the URL in [`scripts/process-geojson.ts`](../scripts/process-geojson.ts), re-run
`geo:process` + `geo:validate`, and add a test in
[`tests/district-normalizer.test.ts`](../tests/district-normalizer.test.ts).
