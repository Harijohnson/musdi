/**
 * Phase 5 — STEP 1-3: discover candidate singers born in Tamil Nadu.
 *
 * Staged (cheap) approach instead of one giant SPARQL query:
 *   STEP 1  fetch the set of singer + singer-subclass occupations
 *   STEP 2  fetch humans with any of those occupations whose place of birth
 *           is located (P131*) within Tamil Nadu, with birthplace + coords
 *   STEP 3  (the TN filter above restricts to Tamil-Nadu birthplaces)
 *
 * Writes .cache/pipeline/candidates.json. Downstream steps add district
 * resolution (resolve-districts) and Wikipedia/image enrichment (enrich).
 *
 * Run:  bun run scripts/fetch-artists.ts [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { sparqlSelect, wbGetEntities, type SparqlBinding } from "../lib/wikimedia/client"

const ROOT = process.cwd()
const PIPELINE_DIR = join(ROOT, ".cache", "pipeline")
const OUT = join(PIPELINE_DIR, "candidates.json")
const SEEDS = join(ROOT, "data", "seed-artists.json")

const SINGER_QID = "Q177220"
const TAMIL_NADU_QID = "Q1445"

export interface Candidate {
  wikidataId: string
  name: string
  birthId: string | null
  birthName: string | null
  latitude: number | null
  longitude: number | null
}

function parsePoint(wkt: string | undefined): { lat: number; lon: number } | null {
  if (!wkt) return null
  const m = wkt.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/)
  if (!m) return null
  return { lon: Number(m[1]), lat: Number(m[2]) }
}

interface SeedEntry {
  wikidataId: string
}

/**
 * Force-include curated QIDs of verified Tamil-Nadu-born singers that the
 * occupation+birthplace SPARQL harvest misses (e.g. Wikidata lists their
 * occupation as songwriter/actor, or has no place of birth). Name, birthplace
 * and coordinates are pulled from Wikidata — nothing is invented. A seed with
 * no resolvable district gets a reviewed, cited entry in manual-overrides.json.
 */
export async function addSeeds(byId: Map<string, Candidate>): Promise<void> {
  if (!existsSync(SEEDS)) return
  const file = JSON.parse(readFileSync(SEEDS, "utf8")) as { seeds?: SeedEntry[] }
  const seedIds = (file.seeds ?? [])
    .map((s) => s.wikidataId)
    .filter((id): id is string => Boolean(id))
  const missing = seedIds.filter((id) => !byId.has(id))
  console.log(`[fetch] seeds: ${seedIds.length} listed, ${missing.length} to add`)
  if (missing.length === 0) return

  // Person entities: label + place of birth (P19).
  const people = await wbGetEntities(missing, "labels|claims")
  const birthIdByPerson = new Map<string, string | null>()
  const birthIds = new Set<string>()
  for (const id of missing) {
    const claims = people[id]?.claims
    const p19 = claims?.P19?.[0]?.mainsnak?.datavalue?.value as { id?: string } | undefined
    const birthId = p19?.id ?? null
    birthIdByPerson.set(id, birthId)
    if (birthId) birthIds.add(birthId)
  }

  // Birthplace entities: label + coordinates (P625).
  const places =
    birthIds.size > 0 ? await wbGetEntities([...birthIds], "labels|claims") : {}

  for (const id of missing) {
    const label = people[id]?.labels?.en?.value ?? id
    const birthId = birthIdByPerson.get(id) ?? null
    const place = birthId ? places[birthId] : undefined
    const coord = place?.claims?.P625?.[0]?.mainsnak?.datavalue?.value as
      | { latitude?: number; longitude?: number }
      | undefined
    byId.set(id, {
      wikidataId: id,
      name: label,
      birthId,
      birthName: birthId ? (place?.labels?.en?.value ?? null) : null,
      latitude: typeof coord?.latitude === "number" ? coord.latitude : null,
      longitude: typeof coord?.longitude === "number" ? coord.longitude : null,
    })
  }
}

async function main() {
  console.log("[fetch] STEP 1: singer + subclass occupations")
  const subclassRows = await sparqlSelect(
    `SELECT ?occ WHERE { ?occ wdt:P279* wd:${SINGER_QID} . }`,
  )
  const occQids = subclassRows
    .map((r) => r.occ?.value.split("/").pop())
    .filter((id): id is string => Boolean(id))
  console.log(`[fetch] singer occupation types: ${occQids.length}`)

  // Query occupations in small batches: a single giant VALUES + P131* closure
  // times out on WDQS, but a handful of occupations per request stays under
  // the 60s limit. A heavy batch (populous occupation) is adaptively split in
  // half, down to a single occupation (reliably fast). Unioned/deduped offline.
  const byId = new Map<string, Candidate>()

  const queryBatch = (occs: string[]): Promise<SparqlBinding[]> => {
    const values = occs.map((q) => `wd:${q}`).join(" ")
    return sparqlSelect(
      `SELECT DISTINCT ?person ?personLabel ?birth ?birthLabel ?coord WHERE {
        VALUES ?occ { ${values} }
        ?person wdt:P106 ?occ ;
                wdt:P19 ?birth .
        ?birth wdt:P131* wd:${TAMIL_NADU_QID} .
        OPTIONAL { ?birth wdt:P625 ?coord . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ta". }
      }`,
      { retryServerErrors: false, retries: 1 },
    )
  }

  const ingest = (rows: SparqlBinding[]) => {
    for (const r of rows) {
      const wikidataId = r.person?.value.split("/").pop()
      if (!wikidataId || byId.has(wikidataId)) continue
      const point = parsePoint(r.coord?.value)
      byId.set(wikidataId, {
        wikidataId,
        name: r.personLabel?.value ?? wikidataId,
        birthId: r.birth?.value.split("/").pop() ?? null,
        birthName: r.birthLabel?.value ?? null,
        latitude: point?.lat ?? null,
        longitude: point?.lon ?? null,
      })
    }
  }

  const processBatch = async (occs: string[]): Promise<void> => {
    try {
      ingest(await queryBatch(occs))
    } catch (err) {
      if (occs.length === 1) {
        console.warn(`[fetch]  occupation ${occs[0]} failed, skipping: ${(err as Error).message}`)
        return
      }
      const mid = Math.ceil(occs.length / 2)
      console.warn(`[fetch]  batch of ${occs.length} too heavy; splitting`)
      await processBatch(occs.slice(0, mid))
      await processBatch(occs.slice(mid))
    }
  }

  console.log("[fetch] STEP 2-3: humans with those occupations born in Tamil Nadu")
  const BATCH = 12
  for (let i = 0; i < occQids.length; i += BATCH) {
    await processBatch(occQids.slice(i, i + BATCH))
    console.log(
      `[fetch]  progress ${Math.min(i + BATCH, occQids.length)}/${occQids.length} ` +
        `occupations, ${byId.size} unique candidates`,
    )
  }

  console.log("[fetch] STEP 3b: force-include curated seed singers")
  await addSeeds(byId)

  const candidates = [...byId.values()]
  mkdirSync(PIPELINE_DIR, { recursive: true })
  writeFileSync(OUT, JSON.stringify(candidates, null, 2))

  const withCoords = candidates.filter((c) => c.latitude !== null).length
  console.log(`\n[fetch] Found candidates: ${candidates.length}`)
  console.log(`[fetch] With birthplace coordinates: ${withCoords}`)
  console.log(`[fetch] wrote ${OUT}`)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[fetch] FAILED:", err)
    process.exit(1)
  })
}
