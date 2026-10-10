import { expect, test, describe } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createProjection } from "../lib/geo/projection"
import {
  districtToShapes,
  buildDistrictGeometry,
} from "../lib/geo/geojson-to-three"
import type { DistrictFeatureCollection } from "../lib/geo/types"

const fc = JSON.parse(
  readFileSync(
    join(import.meta.dir, "..", "public", "data", "tamil-nadu-districts.geojson"),
    "utf8",
  ),
) as DistrictFeatureCollection

describe("projection + geometry build", () => {
  test("loads all 38 districts", () => {
    expect(fc.features.length).toBe(38)
  })

  test("projection centres the state on the origin within the target extent", () => {
    const projection = createProjection(fc)
    const [w, h] = projection.size
    // Larger axis ~= TARGET_SIZE (10); both axes within it.
    expect(Math.max(w, h)).toBeCloseTo(10, 1)
    // A central-ish point projects near origin; corners stay bounded.
    const [cx, cy] = projection.project(
      (projection.bbox[0] + projection.bbox[2]) / 2,
      (projection.bbox[1] + projection.bbox[3]) / 2,
    )
    expect(Math.abs(cx)).toBeLessThan(0.001)
    expect(Math.abs(cy)).toBeLessThan(0.001)
  })

  test("north maps to +Y (orientation not inverted)", () => {
    const projection = createProjection(fc)
    const [, minLat, , maxLat] = projection.bbox
    const south = projection.project(78, minLat)[1]
    const north = projection.project(78, maxLat)[1]
    expect(north).toBeGreaterThan(south)
  })

  test("every district builds a non-empty extruded geometry", () => {
    const projection = createProjection(fc)
    for (const feature of fc.features) {
      const shapes = districtToShapes(feature, projection)
      expect(shapes.length).toBeGreaterThan(0)
      const geometry = buildDistrictGeometry(shapes)
      const pos = geometry.getAttribute("position")
      expect(pos).toBeDefined()
      expect(pos.count).toBeGreaterThan(0)
      // All vertices sit inside a sane world box.
      const arr = pos.array as Float32Array
      for (let i = 0; i < arr.length; i++) {
        expect(Number.isFinite(arr[i])).toBe(true)
        expect(Math.abs(arr[i])).toBeLessThan(12)
      }
      geometry.dispose()
    }
  })

  test("handles MultiPolygon districts (coastal/island pieces)", () => {
    const multi = fc.features.filter((f) => f.geometry.type === "MultiPolygon")
    // Tamil Nadu has several coastal/island districts; at least one expected.
    expect(multi.length).toBeGreaterThan(0)
    const projection = createProjection(fc)
    for (const f of multi) {
      expect(districtToShapes(f, projection).length).toBeGreaterThan(1)
    }
  })
})
