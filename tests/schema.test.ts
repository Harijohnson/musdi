import { expect, test, describe } from "bun:test"
import { artistSchema } from "../lib/artists/schemas"

const validArtist = {
  id: "Q12345",
  wikidataId: "Q12345",
  name: "Test Singer",
  category: ["singer"],
  imageUrl: null,
  wikipedia: null,
  wikidataUrl: "https://www.wikidata.org/wiki/Q12345",
  birthplace: { name: "Madurai", latitude: 9.9, longitude: 78.1 },
  birthplaceDistrict: "Madurai",
  nativePlace: null,
  districtResolution: { method: "geo-point-in-polygon", confidence: "high" },
  sources: [{ type: "wikidata", url: "https://www.wikidata.org/wiki/Q12345" }],
}

describe("artistSchema", () => {
  test("accepts a valid artist with optional fields null", () => {
    expect(artistSchema.safeParse(validArtist).success).toBe(true)
  })

  test("accepts a verified native place", () => {
    const withNative = {
      ...validArtist,
      nativePlace: {
        name: "Woraiyur",
        district: "Tiruchirappalli",
        sourceUrl: "https://en.wikipedia.org/wiki/Example",
        verified: true,
      },
    }
    expect(artistSchema.safeParse(withNative).success).toBe(true)
  })

  test("accepts streaming profile links", () => {
    const withStreaming = {
      ...validArtist,
      streaming: {
        spotify: "https://open.spotify.com/artist/abc123",
        appleMusic: "https://music.apple.com/us/artist/123456",
      },
    }
    expect(artistSchema.safeParse(withStreaming).success).toBe(true)
  })

  test("accepts streaming with one service null", () => {
    const partial = {
      ...validArtist,
      streaming: { spotify: "https://open.spotify.com/artist/abc123", appleMusic: null },
    }
    expect(artistSchema.safeParse(partial).success).toBe(true)
  })

  test("rejects a non-URL streaming link (no guessed links)", () => {
    const bad = {
      ...validArtist,
      streaming: { spotify: "not-a-url", appleMusic: null },
    }
    expect(artistSchema.safeParse(bad).success).toBe(false)
  })

  test("rejects a non-canonical birthplace district (no fabricated districts)", () => {
    const bad = { ...validArtist, birthplaceDistrict: "Atlantis" }
    expect(artistSchema.safeParse(bad).success).toBe(false)
  })

  test("rejects a malformed wikidata id", () => {
    const bad = { ...validArtist, wikidataId: "12345" }
    expect(artistSchema.safeParse(bad).success).toBe(false)
  })

  test("rejects an empty category array", () => {
    const bad = { ...validArtist, category: [] }
    expect(artistSchema.safeParse(bad).success).toBe(false)
  })
})
