import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import { polygon, multiPolygon } from "@turf/helpers"
import type { Feature, Polygon, MultiPolygon } from "geojson"
import type { CanonicalDistrictName } from "./district-normalizer"
import type { DistrictFeatureCollection } from "./types"

/**
 * Build a point-in-polygon resolver over the district GeoJSON.
 *
 * Returns the canonical district whose polygon contains [lng, lat], or null
 * when the point falls outside every district (e.g. just offshore, or a bad
 * coordinate). Never guesses a nearest district — unresolved stays null.
 */
export function createPointResolver(fc: DistrictFeatureCollection) {
  const features: { name: CanonicalDistrictName; feature: Feature<Polygon | MultiPolygon> }[] =
    fc.features.map((f) => ({
      name: f.properties.district,
      feature:
        f.geometry.type === "Polygon"
          ? polygon(f.geometry.coordinates)
          : multiPolygon(f.geometry.coordinates),
    }))

  return function resolvePoint(
    lat: number,
    lng: number,
  ): CanonicalDistrictName | null {
    const pt: [number, number] = [lng, lat]
    for (const { name, feature } of features) {
      if (booleanPointInPolygon(pt, feature)) return name
    }
    return null
  }
}
