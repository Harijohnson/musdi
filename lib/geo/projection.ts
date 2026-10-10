import type { DistrictFeatureCollection, LngLat } from "./types"

/**
 * Geographic bounding box in [minLng, minLat, maxLng, maxLat] order.
 */
export type BBox = [number, number, number, number]

export interface Projection {
  /** Project a geographic [lng, lat] to normalized world [x, y] (origin-centered). */
  project(lng: number, lat: number): [number, number]
  /** Geographic bounding box of the source data. */
  bbox: BBox
  /** Projected world-space extent (width, height) after scaling. */
  size: [number, number]
}

const TARGET_SIZE = 10 // the larger projected dimension spans this many world units

function computeBBox(fc: DistrictFeatureCollection): BBox {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  const visit = (pos: LngLat) => {
    const [lng, lat] = pos
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  for (const f of fc.features) {
    if (f.geometry.type === "Polygon") {
      f.geometry.coordinates.forEach((ring) => ring.forEach(visit))
    } else {
      f.geometry.coordinates.forEach((poly) =>
        poly.forEach((ring) => ring.forEach(visit)),
      )
    }
  }

  return [minLng, minLat, maxLng, maxLat]
}

/**
 * Build a memoizable projection for the whole state.
 *
 * Uses a simple equirectangular (plate carrée) projection corrected for the
 * centre latitude — adequate and distortion-free enough for a single small
 * state — then uniformly scales so the larger axis spans TARGET_SIZE world
 * units and centres the result on the origin. Latitude maps to +Y (north is
 * up / back), so no axis inversion is required downstream.
 */
export function createProjection(fc: DistrictFeatureCollection): Projection {
  const bbox = computeBBox(fc)
  const [minLng, minLat, maxLng, maxLat] = bbox
  const centerLng = (minLng + maxLng) / 2
  const centerLat = (minLat + maxLat) / 2
  const cosLat = Math.cos((centerLat * Math.PI) / 180)

  // Raw projected extents (pre-scale), centred on 0.
  const rawHalfW = ((maxLng - minLng) / 2) * cosLat
  const rawHalfH = (maxLat - minLat) / 2
  const scale = TARGET_SIZE / (2 * Math.max(rawHalfW, rawHalfH))

  const project = (lng: number, lat: number): [number, number] => {
    const x = (lng - centerLng) * cosLat * scale
    const y = (lat - centerLat) * scale
    return [x, y]
  }

  return {
    project,
    bbox,
    size: [rawHalfW * 2 * scale, rawHalfH * 2 * scale],
  }
}
