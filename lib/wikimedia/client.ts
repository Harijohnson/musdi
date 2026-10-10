/**
 * Shared Wikimedia HTTP client for the data-generation scripts.
 *
 * Responsibilities:
 *   - descriptive User-Agent (Wikimedia policy requires one)
 *   - on-disk response cache under .cache/wikimedia (keyed by request)
 *   - polite per-host rate limiting (sequential, min interval)
 *   - retry with backoff; honours Retry-After on HTTP 429
 *   - timeout handling
 *   - never silently swallows errors
 *
 * Node/Bun only — not imported by the browser app.
 */
import { createHash } from "node:crypto"
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const CACHE_DIR = join(process.cwd(), ".cache", "wikimedia")

export const USER_AGENT =
  "musdi/1.0 (https://github.com/webchirpy; team@webchirpy.com) singers-of-tamil-nadu data build"

export const FORCE_REFRESH = process.argv.includes("--force")

/**
 * Cache-only mode: never hit the network; a cache miss yields an empty result.
 * Lets a run assemble whatever has already been fetched without waiting on a
 * throttled/rate-limited endpoint. Enable with --cache-only.
 */
export const CACHE_ONLY = process.argv.includes("--cache-only")

const WDQS_ENDPOINT = "https://query.wikidata.org/sparql"
const WIKIDATA_API = "https://www.wikidata.org/w/api.php"

interface HostLimit {
  minIntervalMs: number
  last: number
}

// Polite minimum spacing between requests to each host.
const limits: Record<string, HostLimit> = {
  "query.wikidata.org": { minIntervalMs: 1500, last: 0 },
  "www.wikidata.org": { minIntervalMs: 400, last: 0 },
  "en.wikipedia.org": { minIntervalMs: 300, last: 0 },
  "ta.wikipedia.org": { minIntervalMs: 300, last: 0 },
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(host: string) {
  const limit = limits[host]
  if (!limit) return
  const wait = limit.last + limit.minIntervalMs - Date.now()
  if (wait > 0) await sleep(wait)
  limit.last = Date.now()
}

function cacheKey(key: string): string {
  return join(CACHE_DIR, createHash("sha1").update(key).digest("hex") + ".json")
}

export function readCache<T>(key: string): T | null {
  if (FORCE_REFRESH) return null
  const path = cacheKey(key)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(cacheKey(key), JSON.stringify(value))
}

const DEFAULT_RETRIES = 4
const TIMEOUT_MS = 60_000

export interface FetchOptions {
  /** Max retry attempts for server errors / network failures. */
  retries?: number
  /**
   * When false, a 5xx or timeout fails immediately (throws) instead of
   * retrying — lets callers adaptively split an over-heavy query. HTTP 429
   * is always honoured (we wait) regardless of this flag.
   */
  retryServerErrors?: boolean
  timeoutMs?: number
}

/**
 * Fetch text with retry/backoff, rate limiting and timeout. Throws on
 * exhausted retries — callers decide how to handle, nothing is swallowed.
 */
async function fetchText(
  url: string,
  accept: string,
  opts: FetchOptions = {},
): Promise<string> {
  const host = new URL(url).host
  const maxRetries = opts.retries ?? DEFAULT_RETRIES
  const retryServer = opts.retryServerErrors ?? true
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await throttle(host)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 429) {
        // When the caller wants fail-fast (adaptive splitting), surface the
        // 429 immediately instead of blocking on Retry-After, so the run can
        // race through cached work and skip the few genuinely stuck queries.
        if (!retryServer) throw new Error(`HTTP 429 for ${url}`)
        const retryAfter = Number(res.headers.get("retry-after")) || 30
        console.warn(`  [429] rate limited by ${host}; waiting ${retryAfter}s`)
        await sleep(retryAfter * 1000)
        continue
      }
      if (res.status >= 500) {
        if (!retryServer) throw new Error(`HTTP ${res.status} for ${url}`)
        const backoff = 2 ** attempt * 2000
        console.warn(`  [${res.status}] ${host}; backoff ${backoff}ms`)
        await sleep(backoff)
        continue
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`)
      }
      return await res.text()
    } catch (err) {
      clearTimeout(timer)
      const isAbort = (err as Error).name === "AbortError"
      if (isAbort && !retryServer) throw err
      if (attempt === maxRetries) throw err
      const backoff = 2 ** attempt * 2000
      console.warn(
        `  [err] ${host}: ${(err as Error).message}; backoff ${backoff}ms`,
      )
      await sleep(backoff)
    }
  }
  throw new Error(`Exhausted retries for ${url}`)
}

export interface SparqlBinding {
  [key: string]: { type: string; value: string; "xml:lang"?: string } | undefined
}

/** Run a SPARQL SELECT and return the result bindings (cached). */
export async function sparqlSelect(
  query: string,
  opts?: FetchOptions,
): Promise<SparqlBinding[]> {
  const url = `${WDQS_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`
  const key = `sparql:${query}`
  const cached = readCache<SparqlBinding[]>(key)
  if (cached) return cached
  if (CACHE_ONLY) return []

  const text = await fetchText(url, "application/sparql-results+json", opts)
  const json = JSON.parse(text) as { results: { bindings: SparqlBinding[] } }
  const bindings = json.results.bindings
  writeCache(key, bindings)
  return bindings
}

/** Minimal shape of a wbgetentities entity we care about. */
export interface WbEntity {
  id: string
  labels?: Record<string, { language: string; value: string }>
  sitelinks?: Record<string, { site: string; title: string; url?: string }>
  claims?: Record<string, WbClaim[]>
}

export interface WbClaim {
  mainsnak?: {
    datavalue?: {
      value: unknown
    }
    snaktype?: string
  }
}

/**
 * Fetch entities via the Wikidata Action API in batches of 50 (cached per
 * batch). `props` e.g. "sitelinks|claims|labels".
 */
export async function wbGetEntities(
  ids: string[],
  props: string,
  languages = "en,ta",
): Promise<Record<string, WbEntity>> {
  const out: Record<string, WbEntity> = {}
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const url =
      `${WIKIDATA_API}?action=wbgetentities&ids=${batch.join("|")}` +
      `&props=${encodeURIComponent(props)}&languages=${languages}` +
      `&sitefilter=enwiki|tawiki&format=json`
    const key = `wbgetentities:${props}:${batch.join(",")}`
    let json = readCache<{ entities: Record<string, WbEntity> }>(key)
    if (!json) {
      const text = await fetchText(url, "application/json")
      json = JSON.parse(text) as { entities: Record<string, WbEntity> }
      writeCache(key, json)
    }
    Object.assign(out, json.entities)
  }
  return out
}
