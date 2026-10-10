# 3D map rendering

The map is built with `three` + `@react-three/fiber` (R3F) + `@react-three/drei`. This
page covers the projection, geometry generation and the scene, plus the R3F pitfalls
that are easy to reintroduce.

## Projection — `lib/geo/projection.ts`

An equirectangular projection centered on the Tamil Nadu bounding box, origin-centered
so the map sits around `(0,0)`. Latitude maps to **+Y** (north up); longitude to +X.

## GeoJSON → geometry — `lib/geo/geojson-to-three.ts`

Each district polygon becomes a `THREE.Shape`, then an `ExtrudeGeometry` with **bevel
off**. Simplification happened earlier in the pipeline (per-polygon Douglas–Peucker), so
the geometry here is already lightweight.

## The scene — `components/map/map-scene.tsx`

- Orthographic camera.
- drei `Bounds` auto-fits the whole group in view.
- Lights for the relief read.
- Constrained `OrbitControls` (limited rotation/zoom so you can't lose the map).
- One [`DistrictMesh`](../components/map/district-mesh.tsx) per GeoJSON feature.

**Coordinate convention:** shapes are built in the XY plane, so extrusion grows along
local **+Z**. The scene group is rotated `-PI/2` on X so that plane lies flat and local
+Z becomes world **+Y** — i.e. districts "rise" upward. A district's elevation is its
mesh's local `position.z`.

## A district — `components/map/district-mesh.tsx`

Geometry and material are memoized. Hover/selection are **state-driven targets**;
`useFrame` lerps the current elevation and colour toward those targets each frame. This
gives smooth raise/settle animations without re-rendering React per frame.

### R3F + react-hooks immutability (the big gotcha)

The strict `react-hooks` lint rules forbid mutating a `useMemo`'d object inside
`useFrame`. So:

- **Do not** mutate the memoized material object in the frame loop.
- **Do** read the material off the mesh **ref** (`mesh.material`) and mutate that.
- **Never** call `setState` per frame — drive animation from refs + lerp, and only use
  React state for the discrete target (hovered / selected / idle).

See `district-mesh.tsx` for the canonical pattern.

## Tooltip — `components/map/district-tooltip.tsx`

The hover card is **DOM, not WebGL** — a regular positioned element, viewport-clamped and
itself hoverable (so the pointer can move from district to card without it closing). The
open/close-intent logic lives up in
[`artist-map.tsx`](../components/map/artist-map.tsx).

## Loading & errors — `components/map/map-loading.tsx`

Skeleton and error states shown while `use-map-data` resolves. Because the scene is a
dynamic `ssr: false` import, there's always a client-side loading window to cover.

## Verifying 3D changes

WebGL interaction can't be fully covered by tests. After any rendering/interaction
change, run `bun run dev` and confirm hover raise, selection, tooltip follow, orbit
constraints and theme switching by eye — in addition to the usual
typecheck/lint/test/build gate.
