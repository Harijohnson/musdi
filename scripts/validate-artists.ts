/**
 * Validate the generated artist + district data (Zod). External Wikimedia data
 * is untrusted, so the final payloads are schema-validated rather than trusted.
 * Also cross-checks referential integrity between districts and artists.
 *
 * Run:  bun run scripts/validate-artists.ts
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { artistDatasetSchema, districtSchema } from "../lib/artists/schemas"
import { z } from "zod"

const ROOT = process.cwd()
const ARTISTS = join(ROOT, "public", "data", "artists.json")
const DISTRICTS = join(ROOT, "public", "data", "districts.json")

function main() {
  for (const p of [ARTISTS, DISTRICTS]) {
    if (!existsSync(p)) {
      console.error(`ERROR: ${p} not found. Run data:generate first.`)
      process.exit(1)
    }
  }

  const dataset = artistDatasetSchema.parse(
    JSON.parse(readFileSync(ARTISTS, "utf8")),
  )
  const districts = z
    .array(districtSchema)
    .parse(JSON.parse(readFileSync(DISTRICTS, "utf8")))

  // Referential integrity: every district.artists id exists and is primarily
  // (by birthplace) in that district; counts are consistent.
  const byId = new Map(dataset.artists.map((a) => [a.id, a]))
  const errors: string[] = []

  for (const d of districts) {
    if (d.artists.length !== d.artistCount) {
      errors.push(`${d.name}: artistCount ${d.artistCount} != ids ${d.artists.length}`)
    }
    for (const id of d.artists) {
      const a = byId.get(id)
      if (!a) {
        errors.push(`${d.name}: references unknown artist id ${id}`)
      } else if (a.birthplaceDistrict !== d.name) {
        errors.push(
          `${d.name}: artist ${id} birthplaceDistrict is ${a.birthplaceDistrict}`,
        )
      }
    }
  }

  // Every resolved artist must appear in exactly its birthplace district.
  const placed = new Set(districts.flatMap((d) => d.artists))
  for (const a of dataset.artists) {
    if (a.birthplaceDistrict && !placed.has(a.id)) {
      errors.push(`artist ${a.id} resolved to ${a.birthplaceDistrict} but not placed`)
    }
  }

  if (errors.length) {
    console.error("Artist data validation FAILED:")
    for (const e of errors) console.error(`  ERROR: ${e}`)
    process.exit(1)
  }

  if (districts.length !== 38) {
    console.error(`ERROR: expected 38 districts, found ${districts.length}`)
    process.exit(1)
  }

  console.log(`[validate] OK — ${dataset.artists.length} artists, 38 districts`)
  console.log(`[validate] resolved: ${dataset.stats.districtResolved}, review: ${dataset.stats.needsReview}`)
}

main()
