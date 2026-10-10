import { expect, test, describe } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createPointResolver } from "../lib/geo/point-in-district"
import type { DistrictFeatureCollection } from "../lib/geo/types"

const fc = JSON.parse(
  readFileSync(
    join(import.meta.dir, "..", "public", "data", "tamil-nadu-districts.geojson"),
    "utf8",
  ),
) as DistrictFeatureCollection

const resolve = createPointResolver(fc)

describe("point-in-polygon district resolution", () => {
  test("a point inside Madurai resolves to Madurai", () => {
    // Madurai city centre ~ 9.925 N, 78.119 E
    expect(resolve(9.925, 78.119)).toBe("Madurai")
  })

  test("a point inside Chennai resolves to Chennai", () => {
    // Chennai ~ 13.08 N, 80.27 E
    expect(resolve(13.08, 80.27)).toBe("Chennai")
  })

  test("a point inside Coimbatore resolves to Coimbatore", () => {
    expect(resolve(11.016, 76.955)).toBe("Coimbatore")
  })

  test("a point far out in the Bay of Bengal resolves to null (never guessed)", () => {
    expect(resolve(13.0, 85.0)).toBeNull()
  })

  test("a point in Bengaluru (outside Tamil Nadu) resolves to null", () => {
    expect(resolve(12.9716, 77.5946)).toBeNull()
  })
})
