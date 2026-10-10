import { z } from "zod"
import { CANONICAL_DISTRICTS } from "@/lib/geo/district-normalizer"

/**
 * Zod schemas for the generated data. External/Wikimedia-derived JSON is
 * untrusted input and must be validated at generation time rather than cast.
 */

const districtNameSchema = z.enum(
  CANONICAL_DISTRICTS as unknown as [string, ...string[]],
)

export const artistCategorySchema = z.enum([
  "singer",
  "actor",
  "music_director",
  "lyricist",
  "dancer",
  "director",
])

export const artistSchema = z.object({
  id: z.string().min(1),
  wikidataId: z.string().regex(/^Q\d+$/),
  name: z.string().min(1),
  category: z.array(artistCategorySchema).min(1),
  imageUrl: z.string().url().nullable(),
  wikipedia: z
    .object({
      language: z.enum(["en", "ta"]),
      title: z.string().min(1),
      url: z.string().url(),
    })
    .nullable(),
  wikidataUrl: z.string().url(),
  birthplace: z.object({
    name: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  }),
  birthplaceDistrict: districtNameSchema.nullable(),
  streaming: z
    .object({
      spotify: z.string().url().nullable(),
      appleMusic: z.string().url().nullable(),
    })
    .optional(),
  nativePlace: z
    .object({
      name: z.string().min(1),
      district: districtNameSchema.nullable(),
      sourceUrl: z.string(),
      verified: z.boolean(),
    })
    .nullable(),
  districtResolution: z.object({
    method: z.enum([
      "wikidata-administrative-hierarchy",
      "geo-point-in-polygon",
      "place-mapping",
      "manual-override",
      "unresolved",
    ]),
    confidence: z.enum(["high", "medium", "manual", "unresolved"]),
  }),
  sources: z.array(
    z.object({
      type: z.enum(["wikidata", "wikipedia", "manual-override"]),
      url: z.string(),
      note: z.string().optional(),
    }),
  ),
})

export const artistDatasetSchema = z.object({
  dataGeneratedAt: z.string(),
  category: artistCategorySchema,
  artists: z.array(artistSchema),
  stats: z.object({
    candidates: z.number(),
    tamilNaduBirthplace: z.number(),
    districtResolved: z.number(),
    needsReview: z.number(),
    withWikipedia: z.number(),
    withImage: z.number(),
  }),
})

export const districtSchema = z.object({
  id: z.string().min(1),
  name: districtNameSchema,
  tamilName: z.string().optional(),
  artists: z.array(z.string()),
  artistCount: z.number().int().nonnegative(),
})
