/**
 * Phase 7 — STEP 4/5: enrich candidates with Wikipedia sitelinks and an
 * optional lead image, from the person's actual Wikimedia sitelinks (never a
 * guessed title).
 *
 * Wikipedia preference: English, then Tamil (Wikidata page used as final
 * fallback at generation time). Image comes from the P18 claim resolved to a
 * stable Wikimedia Commons FilePath thumbnail. Images are optional.
 *
 * Writes .cache/pipeline/enriched.json.
 *
 * Run:  bun run scripts/enrich-artists.ts [--force]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { wbGetEntities } from "../lib/wikimedia/client"
import type { Candidate } from "./fetch-artists"

const ROOT = process.cwd()
const PIPELINE_DIR = join(ROOT, ".cache", "pipeline")
const CANDIDATES = join(PIPELINE_DIR, "candidates.json")
const OUT = join(PIPELINE_DIR, "enriched.json")

const IMAGE_WIDTH = 320

export interface Enriched {
  wikidataId: string
  wikipedia: { language: "en" | "ta"; title: string; url: string } | null
  imageUrl: string | null
  /** null when Wikidata has no Spotify/Apple Music identifier for the person. */
  streaming: { spotify: string | null; appleMusic: string | null } | null
}

function commonsFilePath(filename: string): string {
  const normalized = filename.replace(/ /g, "_")
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    normalized,
  )}?width=${IMAGE_WIDTH}`
}

/** First external-id value for a property, if present and non-empty. */
function externalId(
  claims: Record<string, { mainsnak?: { datavalue?: { value: unknown } } }[]> | undefined,
  property: string,
): string | null {
  const v = claims?.[property]?.[0]?.mainsnak?.datavalue?.value
  return typeof v === "string" && v.length > 0 ? v : null
}

async function main() {
  if (!existsSync(CANDIDATES)) {
    throw new Error(`Missing ${CANDIDATES}. Run data:fetch first.`)
  }
  const candidates = JSON.parse(readFileSync(CANDIDATES, "utf8")) as Candidate[]
  const ids = candidates.map((c) => c.wikidataId)

  console.log(`[enrich] fetching sitelinks + images for ${ids.length} people`)
  const entities = await wbGetEntities(ids, "sitelinks/urls|claims")

  const enriched: Enriched[] = []
  let withWiki = 0
  let withImage = 0
  let withStreaming = 0

  for (const id of ids) {
    const e = entities[id]
    let wikipedia: Enriched["wikipedia"] = null
    let imageUrl: string | null = null

    const en = e?.sitelinks?.enwiki
    const ta = e?.sitelinks?.tawiki
    if (en) {
      wikipedia = {
        language: "en",
        title: en.title,
        url: en.url ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(en.title)}`,
      }
    } else if (ta) {
      wikipedia = {
        language: "ta",
        title: ta.title,
        url: ta.url ?? `https://ta.wikipedia.org/wiki/${encodeURIComponent(ta.title)}`,
      }
    }
    if (wikipedia) withWiki++

    const p18 = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (typeof p18 === "string" && p18.length > 0) {
      imageUrl = commonsFilePath(p18)
      withImage++
    }

    // Streaming profiles from real Wikidata identifier claims (never guessed).
    // P1902 = Spotify artist ID, P2850 = Apple Music artist ID.
    const spotifyId = externalId(e?.claims, "P1902")
    const appleId = externalId(e?.claims, "P2850")
    const spotify = spotifyId ? `https://open.spotify.com/artist/${spotifyId}` : null
    const appleMusic = appleId ? `https://music.apple.com/us/artist/${appleId}` : null
    const streaming = spotify || appleMusic ? { spotify, appleMusic } : null
    if (streaming) withStreaming++

    enriched.push({ wikidataId: id, wikipedia, imageUrl, streaming })
  }

  mkdirSync(PIPELINE_DIR, { recursive: true })
  writeFileSync(OUT, JSON.stringify(enriched, null, 2))

  console.log(`\n[enrich] Wikipedia article found: ${withWiki}`)
  console.log(`[enrich] Image found: ${withImage}`)
  console.log(`[enrich] Streaming profile found: ${withStreaming}`)
  console.log(`[enrich] wrote ${OUT}`)
}

main().catch((err) => {
  console.error("[enrich] FAILED:", err)
  process.exit(1)
})
