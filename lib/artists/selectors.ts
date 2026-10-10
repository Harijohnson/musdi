import {
  CANONICAL_DISTRICTS,
  type CanonicalDistrictName,
} from "@/lib/geo/district-normalizer"
import type { Artist, District } from "./types"

/**
 * Build the 38 District records from the artist list, grouping each artist
 * PRIMARILY under its birthplace district. Artists with an unresolved
 * birthplace district are intentionally not placed in any district (they live
 * in review-needed output instead) — never guessed into one.
 */
export function buildDistricts(artists: Artist[]): District[] {
  const byDistrict = new Map<CanonicalDistrictName, string[]>()
  for (const d of CANONICAL_DISTRICTS) byDistrict.set(d, [])

  for (const artist of artists) {
    const district = artist.birthplaceDistrict
    if (district && byDistrict.has(district)) {
      byDistrict.get(district)!.push(artist.id)
    }
  }

  return CANONICAL_DISTRICTS.map((name) => {
    const ids = byDistrict.get(name)!
    return {
      id: slugifyDistrict(name),
      name,
      artists: ids,
      artistCount: ids.length,
    }
  })
}

export function slugifyDistrict(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Index artists by id for O(1) lookup from district.artists. */
export function indexArtists(artists: Artist[]): Map<string, Artist> {
  return new Map(artists.map((a) => [a.id, a]))
}

export function artistsForDistrict(
  district: District,
  index: Map<string, Artist>,
): Artist[] {
  return district.artists
    .map((id) => index.get(id))
    .filter((a): a is Artist => a !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export interface SearchResult {
  type: "district" | "artist"
  label: string
  /** The district to select / highlight for this result. */
  district: CanonicalDistrictName | null
  /** The artist id, when type === "artist". */
  artistId?: string
}

/**
 * Search districts and artists by name (case-insensitive substring). Artist
 * results resolve to their primary birthplace district so selecting one can
 * highlight the map and open that district's sheet.
 */
export function searchAll(
  query: string,
  districts: District[],
  artists: Artist[],
): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const districtResults: SearchResult[] = districts
    .filter((d) => d.name.toLowerCase().includes(q))
    .map((d) => ({ type: "district", label: d.name, district: d.name }))

  const artistResults: SearchResult[] = artists
    .filter((a) => a.name.toLowerCase().includes(q))
    .map((a) => ({
      type: "artist",
      label: a.name,
      district: a.birthplaceDistrict,
      artistId: a.id,
    }))

  return [...districtResults, ...artistResults].slice(0, 20)
}
