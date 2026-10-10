/**
 * Phase 6 — STEP 6: resolve each candidate's birthplace to a CURRENT district.
 *
 * Strategies, in order (manual override always wins when present):
 *   0. manual override            -> "manual-override" / "manual"
 *   1. Wikidata admin hierarchy   -> "wikidata-administrative-hierarchy" / high
 *      (walk P131 ancestors; any ancestor that is a canonical district)
 *   2. birthplace coordinates     -> "geo-point-in-polygon" / high
 *   3. place name mapping         -> "place-mapping" / medium
 *      (birthplace's own name / alias resolves to a canonical district)
 *   else                          -> null, "unresolved", added to review-needed
 *
 * Never guesses. Writes .cache/pipeline/resolved.json and data/review-needed.json.
 *
 * Run:  bun run scripts/resolve-districts.ts [--force]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { wbGetEntities } from "../lib/wikimedia/client"
import {
  normalizeDistrictName,
  type CanonicalDistrictName,
} from "../lib/geo/district-normalizer"
import { createPointResolver } from "../lib/geo/point-in-district"
import { resolveDistrict } from "../lib/geo/resolve-district"
import type { DistrictFeatureCollection } from "../lib/geo/types"
import type { Candidate } from "./fetch-artists"
import type {
  DistrictResolutionMethod,
  DistrictResolutionConfidence,
} from "../lib/artists/types"

// (method/confidence types are used by the Resolved interface below)

const ROOT = process.cwd()
const PIPELINE_DIR = join(ROOT, ".cache", "pipeline")
const CANDIDATES = join(PIPELINE_DIR, "candidates.json")
const OUT = join(PIPELINE_DIR, "resolved.json")
const REVIEW_OUT = join(ROOT, "data", "review-needed.json")
const GEOJSON = join(ROOT, "public", "data", "tamil-nadu-districts.geojson")
const OVERRIDES = join(ROOT, "data", "manual-overrides.json")

export interface Resolved {
  wikidataId: string
  birthplaceDistrict: CanonicalDistrictName | null
  method: DistrictResolutionMethod
  confidence: DistrictResolutionConfidence
  nativePlace: {
    name: string
    district: CanonicalDistrictName | null
    sourceUrl: string
    verified: boolean
  } | null
}

interface OverrideEntry {
  birthplaceDistrict?: string
  nativePlace?: string
  nativeDistrict?: string
  reason?: string
  source?: string
  reviewed?: boolean
}

function extractP131Targets(entity: {
  claims?: Record<string, { mainsnak?: { datavalue?: { value: unknown } } }[]>
}): string[] {
  const claims = entity.claims?.P131 ?? []
  const ids: string[] = []
  for (const c of claims) {
    const v = c.mainsnak?.datavalue?.value as { id?: string } | undefined
    if (v?.id) ids.push(v.id)
  }
  return ids
}

function entityLabel(entity: {
  labels?: Record<string, { value: string }>
}): string | null {
  return entity.labels?.en?.value ?? null
}

async function main() {
  if (!existsSync(CANDIDATES)) {
    throw new Error(`Missing ${CANDIDATES}. Run data:fetch first.`)
  }
  const candidates = JSON.parse(readFileSync(CANDIDATES, "utf8")) as Candidate[]
  const geojson = JSON.parse(readFileSync(GEOJSON, "utf8")) as DistrictFeatureCollection
  const resolvePoint = createPointResolver(geojson)
  const overridesFile = JSON.parse(readFileSync(OVERRIDES, "utf8")) as {
    overrides: Record<string, OverrideEntry>
  }
  const overrides = overridesFile.overrides ?? {}

  // --- Build admin-hierarchy map for all unique birthplaces (batched, cached).
  // Walk P131 up to a few levels; collect every ancestor entity's label.
  const birthIds = [
    ...new Set(candidates.map((c) => c.birthId).filter((id): id is string => !!id)),
  ]
  console.log(`[resolve] unique birthplaces: ${birthIds.length}`)

  const ancestorDistrict = new Map<string, CanonicalDistrictName>() // birthId -> district via ancestors
  const ownNameDistrict = new Map<string, CanonicalDistrictName>() // birthId -> district via own label

  // Fetch labels + P131 parents in waves (shared entity cache), building a
  // label/parent index we can then walk per birthplace.
  const MAX_LEVELS = 4
  let level = 0
  let wave = [...birthIds]
  const visited = new Set<string>()
  const labelOf = new Map<string, string | null>()
  const parentsOf = new Map<string, string[]>()

  while (wave.length && level < MAX_LEVELS) {
    const toFetch = wave.filter((id) => !visited.has(id))
    wave.forEach((id) => visited.add(id))
    if (toFetch.length === 0) break
    const entities = await wbGetEntities(toFetch, "labels|claims")
    const next: string[] = []
    for (const id of toFetch) {
      const e = entities[id]
      if (!e) continue
      labelOf.set(id, entityLabel(e))
      const parents = extractP131Targets(e)
      parentsOf.set(id, parents)
      next.push(...parents)
    }
    wave = next
    level++
    console.log(`[resolve] admin level ${level}: fetched ${toFetch.length}, next ${next.length}`)
  }

  // For each birthplace, walk its parent chain and record district matches.
  for (const birthId of birthIds) {
    // Own label -> place mapping
    const own = normalizeDistrictName(labelOf.get(birthId) ?? undefined)
    if (own) ownNameDistrict.set(birthId, own)

    // Ancestors (exclude the birth node itself) -> admin hierarchy
    const seen = new Set<string>([birthId])
    let queue = [...(parentsOf.get(birthId) ?? [])]
    while (queue.length) {
      const next: string[] = []
      for (const pid of queue) {
        if (seen.has(pid)) continue
        seen.add(pid)
        const d = normalizeDistrictName(labelOf.get(pid) ?? undefined)
        if (d && !ancestorDistrict.has(birthId)) ancestorDistrict.set(birthId, d)
        next.push(...(parentsOf.get(pid) ?? []))
      }
      if (ancestorDistrict.has(birthId)) break
      queue = next
    }
  }

  // --- Resolve each candidate.
  const resolved: Resolved[] = []
  const review: {
    wikidataId: string
    name: string
    birthplace: string | null
    reason: string
  }[] = []

  for (const c of candidates) {
    const override = overrides[c.wikidataId]

    // Native place only from a reviewed manual override (never guessed).
    let nativePlace: Resolved["nativePlace"] = null
    if (override?.nativePlace && override.reviewed) {
      nativePlace = {
        name: override.nativePlace,
        district: override.nativeDistrict
          ? normalizeDistrictName(override.nativeDistrict)
          : null,
        sourceUrl: override.source ?? "",
        verified: true,
      }
    }

    const { district, method, confidence } = resolveDistrict({
      override,
      ancestorDistrict: c.birthId ? (ancestorDistrict.get(c.birthId) ?? null) : null,
      coords:
        c.latitude !== null && c.longitude !== null
          ? { lat: c.latitude, lon: c.longitude }
          : null,
      resolvePoint,
      ownNameDistrict: c.birthId ? (ownNameDistrict.get(c.birthId) ?? null) : null,
      birthName: c.birthName,
    })

    if (!district) {
      review.push({
        wikidataId: c.wikidataId,
        name: c.name,
        birthplace: c.birthName,
        reason:
          c.latitude === null
            ? "Birthplace has no coordinates and no admin-hierarchy or name match to a current district."
            : "Birthplace coordinates fall outside all current district polygons and no other strategy matched.",
      })
    }

    resolved.push({
      wikidataId: c.wikidataId,
      birthplaceDistrict: district,
      method,
      confidence,
      nativePlace,
    })
  }

  mkdirSync(PIPELINE_DIR, { recursive: true })
  writeFileSync(OUT, JSON.stringify(resolved, null, 2))
  writeFileSync(REVIEW_OUT, JSON.stringify(review, null, 2))

  const byMethod = resolved.reduce<Record<string, number>>((acc, r) => {
    acc[r.method] = (acc[r.method] ?? 0) + 1
    return acc
  }, {})
  const resolvedCount = resolved.filter((r) => r.birthplaceDistrict).length

  console.log(`\n[resolve] District successfully resolved: ${resolvedCount}`)
  console.log(`[resolve] Needs review: ${review.length}`)
  console.log(`[resolve] by method: ${JSON.stringify(byMethod)}`)
  console.log(`[resolve] wrote ${OUT} and ${REVIEW_OUT}`)
}

main().catch((err) => {
  console.error("[resolve] FAILED:", err)
  process.exit(1)
})
