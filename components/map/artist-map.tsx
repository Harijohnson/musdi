"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { CanonicalDistrictName } from "@/lib/geo/district-normalizer"
import type { Artist } from "@/lib/artists/types"
import { indexArtists } from "@/lib/artists/selectors"
import { useMapData } from "@/hooks/use-map-data"
import { MapLoading, MapError } from "./map-loading"
import { DistrictTooltip } from "./district-tooltip"
import { DistrictSheet } from "@/components/district/district-sheet"
import { DistrictNav } from "@/components/district/district-nav"
import { MapSearch } from "@/components/search/map-search"
import { MapInfo } from "./map-info"
import type { HoverInfo } from "./map-scene"

// Three.js must only run on the client. Keep the client boundary narrow by
// dynamically importing just the WebGL scene with SSR disabled.
const MapScene = dynamic(() => import("./map-scene"), {
  ssr: false,
  loading: () => <MapLoading />,
})

const CLOSE_DELAY = 160

export function ArtistMap() {
  const load = useMapData()

  const [selected, setSelected] = useState<CanonicalDistrictName | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [tooltip, setTooltip] = useState<HoverInfo | null>(null)
  const [tooltipHovered, setTooltipHovered] = useState(false)
  const [highlightArtistId, setHighlightArtistId] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirror of tooltipHovered readable synchronously inside the close timer.
  const tooltipHoveredRef = useRef(false)

  const setTooltipHover = useCallback((value: boolean) => {
    tooltipHoveredRef.current = value
    setTooltipHovered(value)
  }, [])

  const data = load.status === "ready" ? load.data : null

  const artistIndex = useMemo(
    () => (data ? indexArtists(data.dataset.artists) : new Map<string, Artist>()),
    [data],
  )

  const districtsWithArtists = useMemo(() => {
    const set = new Set<string>()
    if (data) for (const d of data.districts) if (d.artistCount > 0) set.add(d.name)
    return set
  }, [data])

  const artistsForDistrict = useCallback(
    (name: CanonicalDistrictName | null): Artist[] => {
      if (!name || !data) return []
      const district = data.districts.find((d) => d.name === name)
      if (!district) return []
      return district.artists
        .map((id) => artistIndex.get(id))
        .filter((a): a is Artist => a !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    [data, artistIndex],
  )

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const handleHover = useCallback(
    (info: HoverInfo | null) => {
      if (info) {
        clearCloseTimer()
        setHover(info)
        setTooltip(info)
      } else {
        setHover(null)
        clearCloseTimer()
        closeTimer.current = setTimeout(() => {
          if (!tooltipHoveredRef.current) setTooltip(null)
        }, CLOSE_DELAY)
      }
    },
    [clearCloseTimer],
  )

  const openDistrict = useCallback(
    (name: CanonicalDistrictName, artistId: string | null = null) => {
      setSelected(name)
      setHighlightArtistId(artistId)
      setSheetOpen(true)
      setTooltip(null)
      setHover(null)
    },
    [],
  )

  // Scroll a searched-to artist into view once the sheet is open.
  useEffect(() => {
    if (!sheetOpen || !highlightArtistId) return
    const id = window.setTimeout(() => {
      document
        .getElementById(`artist-${highlightArtistId}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 120)
    return () => window.clearTimeout(id)
  }, [sheetOpen, highlightArtistId])

  useEffect(() => clearCloseTimer, [clearCloseTimer])

  if (load.status === "error") return <MapError message={load.error} />
  if (!data) return <MapLoading />

  // Highlight follows the 3D hover, but persists while the tooltip itself is
  // hovered so its Wikipedia links stay reachable.
  const effectiveHover =
    hover?.district ?? (tooltipHovered ? (tooltip?.district ?? null) : null)
  const tooltipDistrict = tooltip?.district ?? null

  const totalSingers = data.dataset.stats.districtResolved
  const activeDistricts = districtsWithArtists.size

  return (
    <div className="relative h-full w-full select-none">
      <div
        className="absolute inset-0"
        role="application"
        aria-label="Interactive 3D map of Tamil Nadu districts. Use the Districts button or search to browse singers by district."
      >
        <MapScene
          geojson={data.geojson}
          districtsWithArtists={districtsWithArtists}
          hoveredDistrict={effectiveHover}
          selectedDistrict={selected}
          onHover={handleHover}
          onSelect={(name) => openDistrict(name)}
        />
      </div>

      {/* Depth vignette — subtle framing, doesn't capture pointer events. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_90%_at_50%_0%,transparent_55%,rgba(0,0,0,0.55)_100%)]"
      />

      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="pointer-events-auto">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground drop-shadow-sm sm:text-3xl">
            Singers of{" "}
            <span className="bg-linear-to-r from-sky-300 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Tamil Nadu
            </span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalSingers > 0 ? (
              <>
                <span className="font-medium text-foreground/90">
                  {totalSingers} singers
                </span>{" "}
                · {activeDistricts}/38 districts
              </>
            ) : (
              <>38 districts, by birthplace</>
            )}
          </p>
        </div>
        <div className="pointer-events-auto flex items-start gap-1.5">
          <MapSearch
            districts={data.districts}
            artists={data.dataset.artists}
            onSelectDistrict={(name) => openDistrict(name)}
            onSelectArtist={(a) =>
              a.birthplaceDistrict
                ? openDistrict(a.birthplaceDistrict, a.id)
                : undefined
            }
          />
          <MapInfo updatedAt={data.dataset.dataGeneratedAt} />
          <DistrictNav
            districts={data.districts}
            onSelect={(name) => openDistrict(name)}
          />
        </div>
      </div>

      {/* Legend — what the district shades mean. */}
      <div className="pointer-events-none absolute bottom-9 left-4 hidden flex-col gap-1 rounded-lg border border-border/60 bg-popover/70 p-2 text-[10px] text-muted-foreground backdrop-blur sm:flex">
        <LegendDot className="bg-[#394a5f]" label="Has singers" />
        <LegendDot className="bg-[#2b313d]" label="No data yet" />
        <LegendDot className="bg-[#8ec5ff]" label="Selected" />
      </div>

      {/* Interaction hint */}
      <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2">
        <p className="rounded-full border border-border/50 bg-popover/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
          <span className="hidden sm:inline">Hover a district • click to open details</span>
          <span className="sm:hidden">Tap a district to explore</span>
        </p>
      </div>

      {/* Data provenance */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center">
        <p className="text-[10px] text-muted-foreground/80">
          Compiled from Wikidata &amp; Wikipedia and may be incomplete. Updated{" "}
          {new Date(data.dataset.dataGeneratedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Hover tooltip */}
      {tooltipDistrict ? (
        <DistrictTooltip
          district={tooltipDistrict}
          artists={artistsForDistrict(tooltipDistrict)}
          x={tooltip!.x}
          y={tooltip!.y}
          onPointerEnter={() => {
            clearCloseTimer()
            setTooltipHover(true)
          }}
          onPointerLeave={() => {
            setTooltipHover(false)
            setTooltip(null)
          }}
          onOpenDetails={() => openDistrict(tooltipDistrict)}
        />
      ) : null}

      {/* Detail sheet */}
      <DistrictSheet
        district={selected}
        artists={artistsForDistrict(selected)}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setHighlightArtistId(null)
        }}
        highlightArtistId={highlightArtistId}
      />
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-sm ${className}`} />
      {label}
    </span>
  )
}
