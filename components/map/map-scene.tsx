"use client"

import { useMemo } from "react"
import { Canvas, type ThreeEvent } from "@react-three/fiber"
import { Bounds, OrbitControls } from "@react-three/drei"
import { createProjection } from "@/lib/geo/projection"
import type { CanonicalDistrictName } from "@/lib/geo/district-normalizer"
import type { DistrictFeatureCollection } from "@/lib/geo/types"
import { DistrictMesh, type DistrictVisualState } from "./district-mesh"

export interface HoverInfo {
  district: CanonicalDistrictName
  x: number
  y: number
}

interface MapSceneProps {
  geojson: DistrictFeatureCollection
  districtsWithArtists: Set<string>
  hoveredDistrict: CanonicalDistrictName | null
  selectedDistrict: CanonicalDistrictName | null
  onHover: (info: HoverInfo | null) => void
  onSelect: (district: CanonicalDistrictName) => void
}

function stateFor(
  name: CanonicalDistrictName,
  hovered: CanonicalDistrictName | null,
  selected: CanonicalDistrictName | null,
): DistrictVisualState {
  if (selected === name) return "selected"
  if (hovered === name) return "hovered"
  return "normal"
}

export default function MapScene({
  geojson,
  districtsWithArtists,
  hoveredDistrict,
  selectedDistrict,
  onHover,
  onSelect,
}: MapSceneProps) {
  const projection = useMemo(() => createProjection(geojson), [geojson])

  return (
    <Canvas
      orthographic
      camera={{ position: [0, 7, 8], zoom: 60, near: -100, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      className="touch-none"
    >
      <color attach="background" args={["#0a0d14"]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#aaccff", "#1a1f2b", 0.5]} />
      <directionalLight position={[4, 10, 6]} intensity={1.1} />
      <directionalLight position={[-6, 6, -4]} intensity={0.35} color="#6f8cff" />

      <Bounds fit clip observe margin={1.15}>
        {/* Lay the XY-plane map flat (extrusion -> world +Y) for a relief view. */}
        <group rotation={[-Math.PI / 2, 0, 0]}>
          {geojson.features.map((feature) => {
            const name = feature.properties.district
            return (
              <DistrictMesh
                key={name}
                feature={feature}
                projection={projection}
                hasArtists={districtsWithArtists.has(name)}
                state={stateFor(name, hoveredDistrict, selectedDistrict)}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation()
                  document.body.style.cursor = "pointer"
                  onHover({
                    district: name,
                    x: e.nativeEvent.clientX,
                    y: e.nativeEvent.clientY,
                  })
                }}
                onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation()
                  onHover({
                    district: name,
                    x: e.nativeEvent.clientX,
                    y: e.nativeEvent.clientY,
                  })
                }}
                onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation()
                  document.body.style.cursor = "auto"
                  onHover(null)
                }}
                onSelect={(e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation()
                  onSelect(name)
                }}
              />
            )
          })}
        </group>
      </Bounds>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minZoom={35}
        maxZoom={320}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.3}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
      />
    </Canvas>
  )
}
