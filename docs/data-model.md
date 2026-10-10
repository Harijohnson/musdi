# Data model

The model is defined in [`lib/artists/types.ts`](../lib/artists/types.ts) and validated
by the zod schemas in [`lib/artists/schemas.ts`](../lib/artists/schemas.ts). It is
**category-agnostic** on purpose: v1 ships singers, but the same shapes support actors,
music directors, lyricists, dancers and directors.

## `ArtistDataset` — `public/data/artists.json`

```ts
interface ArtistDataset {
  dataGeneratedAt: string        // ISO timestamp from the generate step
  category: ArtistCategory       // the primary category this bundle was built for
  artists: Artist[]
  stats: {
    candidates: number           // people the harvest found
    tamilNaduBirthplace: number  // of those, born in TN
    districtResolved: number     // of those, resolved to a district
    needsReview: number          // unresolved -> data/review-needed.json
    withWikipedia: number
    withImage: number
  }
}
```

## `Artist`

```ts
interface Artist {
  id: string                                  // stable id (Wikidata QID)
  wikidataId: string
  name: string
  category: ArtistCategory[]                  // e.g. ["singer"]; may be multiple
  imageUrl: string | null                     // OPTIONAL — UI must handle null
  wikipedia: WikipediaSitelink | null         // real sitelink (en then ta), never guessed
  wikidataUrl: string
  birthplace: Birthplace                      // { name, latitude, longitude } — all nullable
  birthplaceDistrict: CanonicalDistrictName | null   // null ⇒ not placed on the map
  streaming?: StreamingLinks                  // { spotify, appleMusic } — both nullable
  nativePlace: NativePlace | null             // only when VERIFIED via explicit source
  districtResolution: DistrictResolution      // how birthplaceDistrict was derived
  sources: ArtistSource[]                     // provenance pointers
}
```

Key invariants:

- **`birthplaceDistrict` is the primary grouping.** `null` means the artist is *not*
  placed in any district (it went to review), not "unknown district on the map".
- **`nativePlace` is only set when verified** by an explicit source. Residence,
  workplace, career city and place of death never count.
- **`imageUrl`, `wikipedia`, `streaming` are optional.** Null is normal; render without.

### Supporting types

```ts
type ArtistCategory =
  | "singer" | "actor" | "music_director"
  | "lyricist" | "dancer" | "director"

type DistrictResolutionMethod =
  | "wikidata-administrative-hierarchy"
  | "geo-point-in-polygon"
  | "place-mapping"
  | "manual-override"
  | "unresolved"

type DistrictResolutionConfidence = "high" | "medium" | "manual" | "unresolved"

interface WikipediaSitelink { language: "en" | "ta"; title: string; url: string }
interface Birthplace        { name: string | null; latitude: number | null; longitude: number | null }
interface StreamingLinks    { spotify: string | null; appleMusic: string | null }  // P1902 / P2850
interface NativePlace       { name: string; district: CanonicalDistrictName | null; sourceUrl: string; verified: boolean }
interface ArtistSource      { type: "wikidata" | "wikipedia" | "manual-override"; url: string; note?: string }
```

## `District` — `public/data/districts.json`

```ts
interface District {
  id: string                       // e.g. "ariyalur"
  name: CanonicalDistrictName      // one of the 38 canonical names
  tamilName?: string
  artists: string[]                // artist ids whose birthplace district is this one
  artistCount: number
}
```

Districts reference artists **by id** to avoid duplicating full `Artist` objects.
There are always exactly **38** districts (enforced by `geo:validate`). Canonical names
and aliases live in [`lib/geo/district-normalizer.ts`](../lib/geo/district-normalizer.ts).

## Selectors — `lib/artists/selectors.ts`

The UI reads data through pure helpers: `buildDistricts()`, `indexArtists()`,
`artistsForDistrict()` and `searchAll()` (used by the command palette). Keep these pure
and tested ([`tests/selectors.test.ts`](../tests/selectors.test.ts)).

## Validation rule

External/API JSON is untrusted. **No `any`, no casting** — parse with the zod schemas.
The generated payloads are re-validated by `bun run data:validate`
([`tests/schema.test.ts`](../tests/schema.test.ts) covers the schemas themselves).
