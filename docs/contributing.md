# Contributing & recipes

Before anything else: the hard, non-negotiable data rules are in
[`../AGENTS.md`](../AGENTS.md). They always win. The short version:

1. Never invent artist or district data.
2. Group by **birthplace district**; unresolved ⇒ `null` + `review-needed.json`, never
   a guess.
3. Native place only when **verified** by an explicit source.
4. Current **38-district** map only.
5. Wikipedia URLs from **real sitelinks** only.
6. Images are **optional**.
7. Keep the engine **category-agnostic** (`Artist*`, not `Singer*`).
8. **No `any`**; validate with zod.

## Recipes

### Refresh the singer data

```bash
bun run data:refresh
```

Then review [`data/review-needed.json`](../data/review-needed.json). For anything
fixable, add a **reviewed** entry (with `reason` + `source`) to
[`data/manual-overrides.json`](../data/manual-overrides.json), then re-run
`data:resolve` → `data:generate` → `data:validate`.

### Add a specific singer the harvest misses

The SPARQL harvest only finds people whose Wikidata occupation (`P106`) is singer/a
subclass **and** whose place of birth (`P19`) is within Tamil Nadu — so someone tagged
only "songwriter"/"actor", or with no `P19`, is silently skipped. **Don't relax the
query.** Instead:

1. Verify the person on Wikidata (genuine singer, **born in Tamil Nadu**).
2. Add their QID to [`data/seed-artists.json`](../data/seed-artists.json) with a `reason`
   + `source`. `fetch-artists.ts` force-includes seeds, pulling
   name/birthplace/sitelinks/image from Wikidata.
3. If the birthplace can't resolve to a district (no `P19`, or only the state), add a
   **reviewed, cited** override to `data/manual-overrides.json`.
4. `bun run data:refresh`.

Never seed someone born outside Tamil Nadu.

### Fix a mis-resolved birthplace

Prefer a manual override over touching resolver code. The precedence lives in
[`lib/geo/resolve-district.ts`](../lib/geo/resolve-district.ts) and is unit-tested — if
you do change it, update [`tests/resolve-district.test.ts`](../tests/resolve-district.test.ts).

### Add a new artist category (e.g. actors)

The map engine, selectors, Sheet and search need **no** changes. You only touch the
pipeline + types:

1. Add the occupation QID logic in
   [`scripts/fetch-artists.ts`](../scripts/fetch-artists.ts) (new query or category tag).
2. Set `category` accordingly in [`scripts/generate-data.ts`](../scripts/generate-data.ts).
3. Extend `ArtistCategory` in [`lib/artists/types.ts`](../lib/artists/types.ts) and
   [`lib/artists/schemas.ts`](../lib/artists/schemas.ts).

(v1 filters on `category.includes("singer")`.)

### Update the district map / add an alias

Edit [`data/district-aliases.json`](../data/district-aliases.json) or the source URL in
[`scripts/process-geojson.ts`](../scripts/process-geojson.ts), then:

```bash
bun run geo:process
bun run geo:validate   # must print 38/38
```

Add a normalizer test in
[`tests/district-normalizer.test.ts`](../tests/district-normalizer.test.ts).

### Add a shadcn component

```bash
bunx --bun shadcn@latest add <name>
```

It's Base UI (style `base-nova`), not Radix. Regenerate via the CLI rather than
hand-editing `components/ui/*` heavily.

## Before you ship

```bash
bun run typecheck && bun run lint && bun test && bun run build
```

Plus `bun run data:validate` if you touched data, and a visual check with `bun run dev`
for 3D/interaction changes. See [development.md](development.md).
