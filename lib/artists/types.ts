import type { CanonicalDistrictName } from "@/lib/geo/district-normalizer"

/**
 * Artist categories. v1 ships "singer" only, but the data model and map engine
 * are deliberately category-agnostic so future phases can add actors, music
 * directors, lyricists, dancers and directors without a rewrite.
 */
export type ArtistCategory =
  | "singer"
  | "actor"
  | "music_director"
  | "lyricist"
  | "dancer"
  | "director"

/** How a birthplace was mapped to a current district. */
export type DistrictResolutionMethod =
  | "wikidata-administrative-hierarchy"
  | "geo-point-in-polygon"
  | "place-mapping"
  | "manual-override"
  | "unresolved"

export type DistrictResolutionConfidence =
  | "high"
  | "medium"
  | "manual"
  | "unresolved"

export interface DistrictResolution {
  method: DistrictResolutionMethod
  confidence: DistrictResolutionConfidence
}

/** A free-form provenance pointer for a piece of artist data. */
export interface ArtistSource {
  type: "wikidata" | "wikipedia" | "manual-override"
  url: string
  note?: string
}

export interface WikipediaSitelink {
  language: "en" | "ta"
  title: string
  url: string
}

export interface Birthplace {
  name: string | null
  latitude: number | null
  longitude: number | null
}

/**
 * Links to the artist's profile on streaming services. These are the artist's
 * own pages (their songs / top tracks / artist playlists live there) and are
 * built from real Wikidata identifier claims (Spotify P1902, Apple Music
 * P2850), never guessed. Both are optional — a null means Wikidata has no such
 * identifier for the artist, and the UI must render fine without them.
 */
export interface StreamingLinks {
  spotify: string | null
  appleMusic: string | null
}

/**
 * Native / hometown. Only present when there is a reasonably explicit source.
 * Never inferred from residence, workplace, career city or place of death.
 */
export interface NativePlace {
  name: string
  district: CanonicalDistrictName | null
  sourceUrl: string
  verified: boolean
}

export interface Artist {
  id: string
  wikidataId: string
  name: string
  category: ArtistCategory[]
  imageUrl: string | null
  wikipedia: WikipediaSitelink | null
  wikidataUrl: string
  birthplace: Birthplace
  birthplaceDistrict: CanonicalDistrictName | null
  /** Optional streaming-service profile links (Spotify / Apple Music). */
  streaming?: StreamingLinks
  nativePlace: NativePlace | null
  districtResolution: DistrictResolution
  sources: ArtistSource[]
}

export interface District {
  id: string
  name: CanonicalDistrictName
  tamilName?: string
  /** Artist ids whose primary (birthplace) district is this district. */
  artists: string[]
  artistCount: number
}

/**
 * The generated bundle the UI consumes. Artists are referenced by id from
 * districts to avoid duplicating full Artist objects per district.
 */
export interface ArtistDataset {
  dataGeneratedAt: string
  category: ArtistCategory
  artists: Artist[]
  stats: {
    candidates: number
    tamilNaduBirthplace: number
    districtResolved: number
    needsReview: number
    withWikipedia: number
    withImage: number
  }
}
