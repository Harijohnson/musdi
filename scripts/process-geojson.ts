/**
 * Phase 1 — Geographic data pipeline.
 *
 * Downloads a current (38-district) Tamil Nadu district GeoJSON, reduces
 * coordinate precision, simplifies rings (Douglas–Peucker) to keep the
 * payload small, rewrites each feature's name to the canonical district
 * name, and writes public/data/tamil-nadu-districts.geojson.
 *
 * The large raw source is cached under .cache/ (git-ignored) so repeated
 * runs don't re-download. Pass --force to re-download.
 *
 * Run:  bun run scripts/process-geojson.ts [--force]
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  normalizeDistrictName,
  CANONICAL_DISTRICTS,
  type CanonicalDistrictName,
} from "../lib/geo/district-normalizer"

const ROOT = join(import.meta.dir, "..")
const CACHE_DIR = join(ROOT, ".cache")
const RAW_PATH = join(CACHE_DIR, "tamil-nadu-districts.raw.geojson")
const OUT_PATH = join(ROOT, "public", "data", "tamil-nadu-districts.geojson")

const SOURCE_URL =
  "https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/STATES/TAMIL%20NADU/TAMIL%20NADU_DISTRICTS.geojson"

const SOURCE_NAME_PROP = "dtname"
const COORD_PRECISION = 4 // ~11 m; plenty for a state-level relief map
const SIMPLIFY_TOLERANCE = 0.002 // degrees (~200 m) Douglas–Peucker tolerance

type Position = [number, number]
type Ring = Position[]
type PolygonCoords = Ring[]
type MultiPolygonCoords = PolygonCoords[]

interface RawFeature {
  type: "Feature"
  properties: Record<string, unknown>
  geometry:
    | { type: "Polygon"; coordinates: PolygonCoords }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoords }
}

interface FeatureCollection {
  type: "FeatureCollection"
  features: RawFeature[]
}

const force = process.argv.includes("--force")

function log(msg: string) {
  console.log(`[process-geojson] ${msg}`)
}

async function ensureRaw(): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true })
  if (existsSync(RAW_PATH) && !force) {
    log(`using cached raw source (${mb(statSync(RAW_PATH).size)})`)
    return readFileSync(RAW_PATH, "utf8")
  }
  log(`downloading source: ${SOURCE_URL}`)
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "musdi/1.0 (team@webchirpy.com) geojson-build" },
  })
  if (!res.ok) throw new Error(`source download failed: HTTP ${res.status}`)
  const text = await res.text()
  writeFileSync(RAW_PATH, text)
  log(`downloaded raw source (${mb(text.length)})`)
  return text
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** Perpendicular distance from point p to the segment a→b (planar, degrees). */
function perpDistance(p: Position, a: Position, b: Position): number {
  const [px, py] = p
  const [ax, ay] = a
  const [bx, by] = b
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay)
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** Douglas–Peucker on an open point list. */
function douglasPeucker(points: Position[], tolerance: number): Position[] {
  if (points.length <= 2) return points
  let maxDist = 0
  let index = 0
  const end = points.length - 1
  for (let i = 1; i < end; i++) {
    const d = perpDistance(points[i], points[0], points[end])
    if (d > maxDist) {
      maxDist = d
      index = i
    }
  }
  if (maxDist <= tolerance) return [points[0], points[end]]
  const left = douglasPeucker(points.slice(0, index + 1), tolerance)
  const right = douglasPeucker(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

function round(n: number): number {
  const f = 10 ** COORD_PRECISION
  return Math.round(n * f) / f
}

/** Simplify a closed ring, keeping it closed and valid (>= 4 positions). */
function simplifyRing(ring: Ring): Ring | null {
  // Ring is closed: first == last. Simplify the open path then re-close.
  const open = ring.slice(0, -1)
  let simplified = douglasPeucker(open, SIMPLIFY_TOLERANCE).map(
    ([x, y]) => [round(x), round(y)] as Position,
  )
  // Deduplicate consecutive identical points created by rounding.
  simplified = simplified.filter(
    (p, i) => i === 0 || p[0] !== simplified[i - 1][0] || p[1] !== simplified[i - 1][1],
  )
  if (simplified.length < 3) return null // degenerate, drop this ring
  simplified.push([simplified[0][0], simplified[0][1]])
  return simplified
}

function simplifyPolygon(poly: PolygonCoords): PolygonCoords | null {
  const rings = poly.map(simplifyRing).filter((r): r is Ring => r !== null)
  if (rings.length === 0) return null
  return rings
}

function countPositions(geom: RawFeature["geometry"]): number {
  if (geom.type === "Polygon") {
    return geom.coordinates.reduce((n, r) => n + r.length, 0)
  }
  return geom.coordinates.reduce(
    (n, poly) => n + poly.reduce((m, r) => m + r.length, 0),
    0,
  )
}

async function main() {
  const raw = await ensureRaw()
  const fc = JSON.parse(raw) as FeatureCollection
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new Error("source is not a FeatureCollection")
  }

  let beforePositions = 0
  let afterPositions = 0
  const seen = new Set<CanonicalDistrictName>()
  const unknown: string[] = []

  const outFeatures: RawFeature[] = []

  for (const feature of fc.features) {
    const rawName = String(feature.properties?.[SOURCE_NAME_PROP] ?? "")
    const canonical = normalizeDistrictName(rawName)
    if (!canonical) {
      unknown.push(rawName)
      continue
    }
    seen.add(canonical)
    beforePositions += countPositions(feature.geometry)

    let geometry: RawFeature["geometry"]
    if (feature.geometry.type === "Polygon") {
      const poly = simplifyPolygon(feature.geometry.coordinates)
      if (!poly) throw new Error(`${canonical}: polygon simplified away`)
      geometry = { type: "Polygon", coordinates: poly }
    } else {
      const polys = feature.geometry.coordinates
        .map(simplifyPolygon)
        .filter((p): p is PolygonCoords => p !== null)
      if (polys.length === 0) throw new Error(`${canonical}: multipolygon simplified away`)
      geometry = { type: "MultiPolygon", coordinates: polys }
    }

    afterPositions += countPositions(geometry)

    outFeatures.push({
      type: "Feature",
      // Keep only what the app needs; canonical name is authoritative.
      properties: { district: canonical, source: rawName },
      geometry,
    })
  }

  // Sort features by canonical name for a stable, diff-friendly output.
  outFeatures.sort((a, b) =>
    String(a.properties.district).localeCompare(String(b.properties.district)),
  )

  const out: FeatureCollection = { type: "FeatureCollection", features: outFeatures }
  mkdirSync(join(ROOT, "public", "data"), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(out))

  const missing = CANONICAL_DISTRICTS.filter((d) => !seen.has(d))

  log(`features written: ${outFeatures.length}`)
  log(`positions: ${beforePositions} -> ${afterPositions} (${(
    (100 * afterPositions) / beforePositions
  ).toFixed(1)}% kept)`)
  log(`output size: ${mb(statSync(OUT_PATH).size)}`)
  if (unknown.length) log(`unknown source names skipped: ${JSON.stringify(unknown)}`)
  if (missing.length) {
    log(`MISSING canonical districts: ${JSON.stringify(missing)}`)
    process.exit(1)
  }
  log(`all ${seen.size}/38 canonical districts present`)
}

main().catch((err) => {
  console.error("[process-geojson] FAILED:", err)
  process.exit(1)
})
