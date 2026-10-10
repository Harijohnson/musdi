import * as THREE from "three"
import type { Projection } from "./projection"
import type { DistrictFeature, PolygonCoordinates } from "./types"

/**
 * Extrusion depth (world units) for the base relief. Small relative to the
 * ~10-unit map extent so the map reads as a premium relief, not tall blocks.
 */
export const EXTRUDE_DEPTH = 0.22

/**
 * Build THREE.Shape objects for a single GeoJSON polygon: the first ring is
 * the outer boundary, any remaining rings become holes. Winding order is
 * irrelevant — THREE treats the `holes` array as holes regardless.
 */
function polygonToShape(poly: PolygonCoordinates, projection: Projection): THREE.Shape {
  const [outer, ...holes] = poly
  const shape = new THREE.Shape()

  outer.forEach(([lng, lat], i) => {
    const [x, y] = projection.project(lng, lat)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })

  for (const holeRing of holes) {
    const path = new THREE.Path()
    holeRing.forEach(([lng, lat], i) => {
      const [x, y] = projection.project(lng, lat)
      if (i === 0) path.moveTo(x, y)
      else path.lineTo(x, y)
    })
    shape.holes.push(path)
  }

  return shape
}

/**
 * All shapes that make up one district. A Polygon yields one shape; a
 * MultiPolygon yields several — all belonging to the same logical district so
 * they can be extruded into a single geometry and react as one unit.
 */
export function districtToShapes(
  feature: DistrictFeature,
  projection: Projection,
): THREE.Shape[] {
  if (feature.geometry.type === "Polygon") {
    return [polygonToShape(feature.geometry.coordinates, projection)]
  }
  return feature.geometry.coordinates.map((poly) => polygonToShape(poly, projection))
}

/**
 * Build a single extruded geometry for a district from its shapes.
 * ExtrudeGeometry accepts an array of shapes, so MultiPolygon districts become
 * one geometry. Bevel is disabled by default: on dense shared borders it can
 * distort adjacent boundaries, so we keep crisp walls.
 */
export function buildDistrictGeometry(
  shapes: THREE.Shape[],
  depth = EXTRUDE_DEPTH,
): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: false,
    steps: 1,
  })
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Build flat outline geometries (one per ring) for a district, used by the
 * Phase 2 2D orientation test and as crisp district edges in 3D.
 */
export function districtToOutlines(
  feature: DistrictFeature,
  projection: Projection,
): THREE.BufferGeometry[] {
  const rings: number[][][] =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat()

  return rings.map((ring) => {
    const points = ring.map(([lng, lat]) => {
      const [x, y] = projection.project(lng, lat)
      return new THREE.Vector3(x, y, 0)
    })
    return new THREE.BufferGeometry().setFromPoints(points)
  })
}
