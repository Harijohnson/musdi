/**
 * Phase 1 — GeoJSON validator.
 *
 * Validates public/data/tamil-nadu-districts.geojson against the canonical
 * 38-district list. Fails (non-zero exit) on any of:
 *   - not a FeatureCollection
 *   - feature count / normalized district count != 38
 *   - duplicate district names
 *   - missing geometry
 *   - unsupported geometry (anything but Polygon / MultiPolygon)
 *   - unknown (unnormalizable) district names
 *   - a canonical district missing from the file
 *
 * Run:  bun run scripts/validate-districts.ts
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import {
  normalizeDistrictName,
  CANONICAL_DISTRICTS,
  type CanonicalDistrictName,
} from "../lib/geo/district-normalizer"

const ROOT = join(import.meta.dir, "..")
const GEOJSON_PATH = join(ROOT, "public", "data", "tamil-nadu-districts.geojson")

const errors: string[] = []
function err(msg: string) {
  errors.push(msg)
}

function main() {
  if (!existsSync(GEOJSON_PATH)) {
    console.error(
      `ERROR:\nGeoJSON not found at ${GEOJSON_PATH}. Run: bun run scripts/process-geojson.ts`,
    )
    process.exit(1)
  }

  const data = JSON.parse(readFileSync(GEOJSON_PATH, "utf8")) as unknown

  if (
    typeof data !== "object" ||
    data === null ||
    (data as { type?: unknown }).type !== "FeatureCollection"
  ) {
    console.error("ERROR:\nFeatureCollection missing")
    process.exit(1)
  }

  const fc = data as { type: string; features?: unknown }
  if (!Array.isArray(fc.features)) {
    console.error("ERROR:\nFeatureCollection has no features array")
    process.exit(1)
  }

  const seen = new Map<CanonicalDistrictName, number>()

  fc.features.forEach((feature, i) => {
    const f = feature as {
      properties?: Record<string, unknown>
      geometry?: { type?: string; coordinates?: unknown }
    }
    const rawName = String(f.properties?.district ?? f.properties?.dtname ?? "")
    const canonical = normalizeDistrictName(rawName)

    if (!canonical) {
      err(`Unknown district name: "${rawName}" (feature index ${i})`)
      return
    }

    seen.set(canonical, (seen.get(canonical) ?? 0) + 1)

    if (!f.geometry || !f.geometry.type) {
      err(`District geometry missing: ${canonical}`)
      return
    }
    if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") {
      err(`Unsupported geometry (${f.geometry.type}) for district: ${canonical}`)
      return
    }
    if (!Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length === 0) {
      err(`Empty geometry coordinates: ${canonical}`)
    }
  })

  for (const [name, count] of seen) {
    if (count > 1) err(`Duplicate normalized district: ${name} (x${count})`)
  }

  for (const d of CANONICAL_DISTRICTS) {
    if (!seen.has(d)) err(`Missing district: ${d}`)
  }

  const normalizedCount = seen.size
  if (normalizedCount !== 38) {
    err(`Expected 38 normalized districts, found ${normalizedCount}`)
  }

  if (errors.length > 0) {
    console.error("GeoJSON validation FAILED:\n")
    for (const e of errors) console.error(`ERROR:\n${e}\n`)
    process.exit(1)
  }

  console.log("38/38 districts validated\n")
  console.log("Canonical district names:")
  for (const d of [...CANONICAL_DISTRICTS].sort()) console.log(`  ${d}`)
}

main()
