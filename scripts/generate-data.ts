/**
 * Phase 8 — STEP 7: assemble the final generated data the UI consumes.
 *
 * Merges candidates + district resolution + Wikipedia/image enrichment into
 * Artist[], groups them PRIMARILY by birthplace district into District[], and
 * writes public/data/artists.json and public/data/districts.json with real
 * stats. Nothing is fabricated; unresolved artists simply have a null
 * birthplaceDistrict and are not placed in any district.
 *
 * Run:  bun run scripts/generate-data.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { buildDistricts } from "../lib/artists/selectors"
import type { Artist, ArtistDataset, ArtistSource } from "../lib/artists/types"
import type { Candidate } from "./fetch-artists"
import type { Resolved } from "./resolve-districts"
import type { Enriched } from "./enrich-artists"

const ROOT = process.cwd()
const PIPELINE_DIR = join(ROOT, ".cache", "pipeline")
const CANDIDATES = join(PIPELINE_DIR, "candidates.json")
const RESOLVED = join(PIPELINE_DIR, "resolved.json")
const ENRICHED = join(PIPELINE_DIR, "enriched.json")
const ARTISTS_OUT = join(ROOT, "public", "data", "artists.json")
const DISTRICTS_OUT = join(ROOT, "public", "data", "districts.json")

function requireFile(path: string, step: string) {
  if (!existsSync(path)) throw new Error(`Missing ${path}. Run ${step} first.`)
}

function main() {
  requireFile(CANDIDATES, "data:fetch")
  requireFile(RESOLVED, "data:resolve")
  requireFile(ENRICHED, "data:enrich")

  const candidates = JSON.parse(readFileSync(CANDIDATES, "utf8")) as Candidate[]
  const resolved = new Map(
    (JSON.parse(readFileSync(RESOLVED, "utf8")) as Resolved[]).map((r) => [
      r.wikidataId,
      r,
    ]),
  )
  const enriched = new Map(
    (JSON.parse(readFileSync(ENRICHED, "utf8")) as Enriched[]).map((e) => [
      e.wikidataId,
      e,
    ]),
  )

  const artists: Artist[] = candidates.map((c) => {
    const r = resolved.get(c.wikidataId)
    const e = enriched.get(c.wikidataId)
    const wikidataUrl = `https://www.wikidata.org/wiki/${c.wikidataId}`

    const sources: ArtistSource[] = [{ type: "wikidata", url: wikidataUrl }]
    if (e?.wikipedia) sources.push({ type: "wikipedia", url: e.wikipedia.url })
    if (r?.nativePlace?.verified && r.nativePlace.sourceUrl) {
      sources.push({
        type: "manual-override",
        url: r.nativePlace.sourceUrl,
        note: "Verified native place",
      })
    }

    return {
      id: c.wikidataId,
      wikidataId: c.wikidataId,
      name: c.name,
      category: ["singer"],
      imageUrl: e?.imageUrl ?? null,
      wikipedia: e?.wikipedia ?? null,
      wikidataUrl,
      birthplace: {
        name: c.birthName,
        latitude: c.latitude,
        longitude: c.longitude,
      },
      birthplaceDistrict: r?.birthplaceDistrict ?? null,
      ...(e?.streaming ? { streaming: e.streaming } : {}),
      nativePlace: r?.nativePlace ?? null,
      districtResolution: {
        method: r?.method ?? "unresolved",
        confidence: r?.confidence ?? "unresolved",
      },
      sources,
    }
  })

  // Stable ordering by name for diff-friendly output.
  artists.sort((a, b) => a.name.localeCompare(b.name))

  const districts = buildDistricts(artists)

  const dataset: ArtistDataset = {
    dataGeneratedAt: new Date().toISOString(),
    category: "singer",
    artists,
    stats: {
      candidates: candidates.length,
      tamilNaduBirthplace: candidates.length,
      districtResolved: artists.filter((a) => a.birthplaceDistrict).length,
      needsReview: artists.filter((a) => !a.birthplaceDistrict).length,
      withWikipedia: artists.filter((a) => a.wikipedia).length,
      withImage: artists.filter((a) => a.imageUrl).length,
    },
  }

  writeFileSync(ARTISTS_OUT, JSON.stringify(dataset, null, 2))
  writeFileSync(DISTRICTS_OUT, JSON.stringify(districts, null, 2))

  console.log("\n[generate] FINAL DATA")
  console.log(`  Found candidates: ${dataset.stats.candidates}`)
  console.log(`  Tamil Nadu birthplace candidates: ${dataset.stats.tamilNaduBirthplace}`)
  console.log(`  District successfully resolved: ${dataset.stats.districtResolved}`)
  console.log(`  Needs review: ${dataset.stats.needsReview}`)
  console.log(`  Wikipedia article found: ${dataset.stats.withWikipedia}`)
  console.log(`  Image found: ${dataset.stats.withImage}`)
  console.log(`  wrote ${ARTISTS_OUT}`)
  console.log(`  wrote ${DISTRICTS_OUT}`)
}

try {
  main()
} catch (err) {
  console.error("[generate] FAILED:", err)
  process.exit(1)
}
