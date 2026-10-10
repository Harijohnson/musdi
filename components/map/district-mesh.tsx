"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import type { Projection } from "@/lib/geo/projection"
import type { DistrictFeature } from "@/lib/geo/types"
import { buildDistrictGeometry, districtToShapes } from "@/lib/geo/geojson-to-three"

export type DistrictVisualState = "normal" | "hovered" | "selected"

// Palette (dark data-viz). Created once at module scope; never per-frame.
const COLOR_BASE = new THREE.Color("#2b313d")
const COLOR_BASE_WITH_ARTISTS = new THREE.Color("#394a5f")
const COLOR_HOVERED = new THREE.Color("#5b9dff")
const COLOR_SELECTED = new THREE.Color("#8ec5ff")
const COLOR_EMISSIVE = new THREE.Color("#2f6bd6")

const ELEVATION: Record<DistrictVisualState, number> = {
  normal: 0,
  hovered: 0.16,
  selected: 0.28,
}

interface DistrictMeshProps {
  feature: DistrictFeature
  projection: Projection
  state: DistrictVisualState
  hasArtists: boolean
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void
  onSelect: (event: ThreeEvent<MouseEvent>) => void
}

export function DistrictMesh({
  feature,
  projection,
  state,
  hasArtists,
  onPointerOver,
  onPointerMove,
  onPointerOut,
  onSelect,
}: DistrictMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const edgesRef = useRef<THREE.LineSegments>(null)

  const geometry = useMemo(
    () => buildDistrictGeometry(districtToShapes(feature, projection)),
    [feature, projection],
  )

  const edgeGeometry = useMemo(
    () => new THREE.EdgesGeometry(geometry, 25),
    [geometry],
  )

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: (hasArtists ? COLOR_BASE_WITH_ARTISTS : COLOR_BASE).clone(),
        emissive: COLOR_EMISSIVE.clone(),
        emissiveIntensity: 0,
        roughness: 0.68,
        metalness: 0.08,
        flatShading: false,
      }),
    [hasArtists],
  )

  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color("#0c0f16"),
        transparent: true,
        opacity: 0.55,
      }),
    [],
  )

  // Dispose GPU resources on unmount / dependency change.
  useEffect(() => {
    return () => {
      geometry.dispose()
      edgeGeometry.dispose()
      material.dispose()
      edgeMaterial.dispose()
    }
  }, [geometry, edgeGeometry, material, edgeMaterial])

  const baseColor = hasArtists ? COLOR_BASE_WITH_ARTISTS : COLOR_BASE

  // Smoothly animate elevation + colour toward the target for the current
  // state. State is prop-driven (not per-frame); only interpolation runs here.
  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    // Mutate the material owned by the mesh instance (via ref), not the
    // memoized value — keeps the frame loop side-effect-free w.r.t. hooks.
    const mat = mesh.material as THREE.MeshStandardMaterial

    const targetZ = ELEVATION[state]
    const targetColor =
      state === "selected"
        ? COLOR_SELECTED
        : state === "hovered"
          ? COLOR_HOVERED
          : baseColor
    const targetEmissive = state === "normal" ? 0 : state === "selected" ? 0.9 : 0.55

    // Frame-rate independent smoothing.
    const t = 1 - Math.pow(0.0015, delta)
    mesh.position.z += (targetZ - mesh.position.z) * t
    mat.color.lerp(targetColor, t)
    mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * t

    if (edgesRef.current) edgesRef.current.position.z = mesh.position.z
  })

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onPointerOver={onPointerOver}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onClick={onSelect}
      />
      <lineSegments ref={edgesRef} geometry={edgeGeometry} material={edgeMaterial} />
    </group>
  )
}
