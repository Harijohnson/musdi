import { expect, test, describe } from "bun:test"
import {
  buildDistricts,
  indexArtists,
  artistsForDistrict,
  searchAll,
} from "../lib/artists/selectors"
import type { Artist } from "../lib/artists/types"

function artist(id: string, name: string, district: Artist["birthplaceDistrict"]): Artist {
  return {
    id,
    wikidataId: `Q${id}`,
    name,
    category: ["singer"],
    imageUrl: null,
    wikipedia: null,
    wikidataUrl: `https://www.wikidata.org/wiki/Q${id}`,
    birthplace: { name: null, latitude: null, longitude: null },
    birthplaceDistrict: district,
    nativePlace: null,
    districtResolution: { method: "unresolved", confidence: "unresolved" },
    sources: [],
  }
}

const artists: Artist[] = [
  artist("1", "Anitha", "Madurai"),
  artist("2", "Bala", "Madurai"),
  artist("3", "Chandra", "Chennai"),
  artist("4", "Devi", null), // unresolved — must not be placed anywhere
]

describe("buildDistricts", () => {
  const districts = buildDistricts(artists)

  test("always produces all 38 districts", () => {
    expect(districts.length).toBe(38)
  })

  test("groups artists primarily by birthplace district", () => {
    const madurai = districts.find((d) => d.name === "Madurai")!
    expect(madurai.artistCount).toBe(2)
    expect(madurai.artists.sort()).toEqual(["1", "2"])
  })

  test("never places an artist with an unresolved district", () => {
    const placed = new Set(districts.flatMap((d) => d.artists))
    expect(placed.has("4")).toBe(false)
  })

  test("districts with no artists have count 0, not errors", () => {
    const ariyalur = districts.find((d) => d.name === "Ariyalur")!
    expect(ariyalur.artistCount).toBe(0)
    expect(ariyalur.artists).toEqual([])
  })
})

describe("artistsForDistrict", () => {
  test("returns the artists of a district sorted by name", () => {
    const districts = buildDistricts(artists)
    const index = indexArtists(artists)
    const madurai = districts.find((d) => d.name === "Madurai")!
    expect(artistsForDistrict(madurai, index).map((a) => a.name)).toEqual([
      "Anitha",
      "Bala",
    ])
  })
})

describe("searchAll", () => {
  const districts = buildDistricts(artists)

  test("finds matching districts", () => {
    const results = searchAll("madur", districts, artists)
    expect(results.some((r) => r.type === "district" && r.district === "Madurai")).toBe(
      true,
    )
  })

  test("finds matching artists and maps them to their birthplace district", () => {
    const results = searchAll("chandra", districts, artists)
    const hit = results.find((r) => r.type === "artist")
    expect(hit?.district).toBe("Chennai")
    expect(hit?.artistId).toBe("3")
  })

  test("empty query returns nothing", () => {
    expect(searchAll("   ", districts, artists)).toEqual([])
  })
})
