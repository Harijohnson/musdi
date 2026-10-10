# musdi engineering wiki

Reference docs for working on musdi. The product spec and the hard, enforced
data-integrity rules live in [`../AGENTS.md`](../AGENTS.md); the practical "how to
work in this repo" guide is [`../CLAUDE.md`](../CLAUDE.md). These pages go deeper on
specific subsystems.

## Pages

- [Architecture](architecture.md) — how the app is wired, from JSON load to WebGL.
- [Data pipeline](data-pipeline.md) — the staged Wikidata/Wikipedia harvest and the
  generated `public/data` payloads.
- [3D map rendering](rendering.md) — projection, geometry, the scene, and the R3F
  frame-loop gotchas.
- [Data model](data-model.md) — the `Artist` / `District` / `ArtistDataset` shapes and
  what each field means.
- [Development guide](development.md) — setup, commands, testing, and the
  before-you-ship checklist.
- [Contributing & recipes](contributing.md) — common changes (add a singer, fix a
  district, add a category, update the map).

## The one rule that governs everything

musdi is **data-honest**: nothing on the map is invented. Every artist, district,
image and link traces back to a real Wikidata/Wikipedia source, resolved offline by
scripts and committed as static JSON. If data can't be resolved safely it goes to
`data/review-needed.json` — it is never guessed onto the map. See
[`../AGENTS.md`](../AGENTS.md) for the full list.
