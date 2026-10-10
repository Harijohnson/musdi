import type { CanonicalDistrictName } from "./district-normalizer"

/** A [longitude, latitude] pair as stored in GeoJSON. */
export type LngLat = [number, number]

export type PolygonCoordinates = LngLat[][]
export type MultiPolygonCoordinates = LngLat[][][]

export type DistrictGeometry =
  | { type: "Polygon"; coordinates: PolygonCoordinates }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoordinates }

export interface DistrictFeature {
  type: "Feature"
  properties: {
    district: CanonicalDistrictName
    source?: string
  }
  geometry: DistrictGeometry
}

export interface DistrictFeatureCollection {
  type: "FeatureCollection"
  features: DistrictFeature[]
}
