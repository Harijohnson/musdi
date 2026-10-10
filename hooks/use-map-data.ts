"use client"

import { useEffect, useState } from "react"
import type { DistrictFeatureCollection } from "@/lib/geo/types"
import type { ArtistDataset, District } from "@/lib/artists/types"

export interface MapData {
  geojson: DistrictFeatureCollection
  districts: District[]
  dataset: ArtistDataset
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: MapData }

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status})`)
  return (await res.json()) as T
}

/**
 * Loads the three generated static JSON payloads from /data. All data is
 * pre-generated; nothing hits Wikimedia at runtime. Surfaces explicit
 * loading / error states so the UI never renders against malformed data.
 */
export function useMapData(): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    Promise.all([
      fetchJson<DistrictFeatureCollection>(
        "/data/tamil-nadu-districts.geojson",
        signal,
      ),
      fetchJson<District[]>("/data/districts.json", signal),
      fetchJson<ArtistDataset>("/data/artists.json", signal),
    ])
      .then(([geojson, districts, dataset]) => {
        if (
          geojson?.type !== "FeatureCollection" ||
          !Array.isArray(geojson.features)
        ) {
          throw new Error("District map data is malformed.")
        }
        if (!Array.isArray(districts) || !Array.isArray(dataset?.artists)) {
          throw new Error("Artist data is malformed.")
        }
        setState({ status: "ready", data: { geojson, districts, dataset } })
      })
      .catch((err: unknown) => {
        if (signal.aborted) return
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error loading map data.",
        })
      })

    return () => controller.abort()
  }, [])

  return state
}
