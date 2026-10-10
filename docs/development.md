# Development guide

## Prerequisites

- **Bun** (this repo uses `bun.lock`). Do not introduce npm/pnpm/yarn lockfiles.
- No external services needed to run the app — it reads committed JSON from
  `public/data/`.

## Setup

```bash
bun install
bun run dev        # http://localhost:3000
```

## Commands

```bash
bun run dev         # next dev (Turbopack)
bun run build       # production build
bun run start       # serve the production build
bun run typecheck   # tsc --noEmit
bun run lint        # eslint (flat config; strict react-hooks rules)
bun test            # all tests (bun:test)
bun run format      # prettier --write (no semicolons)
```

Data + geo commands are documented in [data-pipeline.md](data-pipeline.md).

## Conventions

- **TypeScript, no `any`.** Validate untrusted JSON with zod.
- **Prettier, no semicolons** (`.prettierrc`). Match existing style.
- **Tailwind v4** — CSS-first config in [`app/globals.css`](../app/globals.css); there
  is no `tailwind.config.js`. Theme tokens are OKLCH CSS vars (light + `.dark`).
- **shadcn is Base UI, not Radix.** Add components with
  `bunx --bun shadcn@latest add <name>`. Dialog/Sheet use `open` / `onOpenChange`;
  triggers use `render={<Button/>}`. Don't hand-write Radix-style components.
- **`cn`** comes from the `cn` package (`import { cn } from "cn"` or `@/lib/utils`), not
  clsx + twMerge.
- **Next 16 specifics:** `error.tsx` uses `retry` (not `reset`); `ssr: false` dynamic
  imports are only allowed inside Client Components. Read
  `node_modules/next/dist/docs/` before framework-level work — this Next is newer than
  most training data.

## Testing

Tests live in [`tests/`](../tests/) and run under `bun:test` (no Jest/Vitest):

- `district-normalizer.test.ts` — canonical names + alias resolution.
- `geojson-to-three.test.ts` — geometry generation.
- `point-in-district.test.ts` — turf point-in-polygon.
- `resolve-district.test.ts` — the pure resolver's strategy precedence.
- `schema.test.ts` — zod schemas.
- `selectors.test.ts` — the UI selectors.

Pure logic (resolver, normalizer, selectors, projection) should stay unit-testable; add
a test alongside any behavioural change. The resolver's precedence is covered by
`resolve-district.test.ts` — update it if you change
[`lib/geo/resolve-district.ts`](../lib/geo/resolve-district.ts).

## Before you ship

Run, in order, and make each pass:

```bash
bun run typecheck && bun run lint && bun test && bun run build
```

The production **build passing is the bar.** If you changed data, also run
`bun run data:validate`. For 3D/interaction changes, confirm the map visually with
`bun run dev` (see [rendering.md](rendering.md)) — WebGL can't be fully covered by
tests.
