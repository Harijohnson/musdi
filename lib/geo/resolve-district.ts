import {
  normalizeDistrictName,
  type CanonicalDistrictName,
} from "./district-normalizer"
import type {
  DistrictResolutionMethod,
  DistrictResolutionConfidence,
} from "@/lib/artists/types"

export interface ResolveInputs {
  /** Reviewed manual override for this artist, if any. */
  override?: { birthplaceDistrict?: string | null; reviewed?: boolean } | null
  /** District found by walking the birthplace's P131 admin ancestors. */
  ancestorDistrict?: CanonicalDistrictName | null
  /** Birthplace coordinates, if known. */
  coords?: { lat: number; lon: number } | null
  /** Point-in-polygon resolver over the current district GeoJSON. */
  resolvePoint?: (lat: number, lon: number) => CanonicalDistrictName | null
  /** District from the birthplace's own name normalizing to a district. */
  ownNameDistrict?: CanonicalDistrictName | null
  /** Raw birthplace label (last-resort name normalization). */
  birthName?: string | null
}

export interface ResolveResult {
  district: CanonicalDistrictName | null
  method: DistrictResolutionMethod
  confidence: DistrictResolutionConfidence
}

/**
 * Resolve a birthplace to a CURRENT district using the project's strategy
 * precedence. A reviewed manual override always wins; otherwise admin
 * hierarchy, then geo point-in-polygon, then place-name mapping. Returns a
 * null district with "unresolved" when nothing matches — never a guess.
 */
export function resolveDistrict(inputs: ResolveInputs): ResolveResult {
  const { override, ancestorDistrict, coords, resolvePoint, ownNameDistrict, birthName } =
    inputs

  if (override?.reviewed && override.birthplaceDistrict) {
    const d = normalizeDistrictName(override.birthplaceDistrict)
    if (d) return { district: d, method: "manual-override", confidence: "manual" }
  }

  if (ancestorDistrict) {
    return {
      district: ancestorDistrict,
      method: "wikidata-administrative-hierarchy",
      confidence: "high",
    }
  }

  if (coords && resolvePoint) {
    const d = resolvePoint(coords.lat, coords.lon)
    if (d) return { district: d, method: "geo-point-in-polygon", confidence: "high" }
  }

  if (ownNameDistrict) {
    return { district: ownNameDistrict, method: "place-mapping", confidence: "medium" }
  }

  const direct = normalizeDistrictName(birthName ?? undefined)
  if (direct) {
    return { district: direct, method: "place-mapping", confidence: "medium" }
  }

  return { district: null, method: "unresolved", confidence: "unresolved" }
}
