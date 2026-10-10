import aliasData from "@/data/district-aliases.json"

/**
 * The canonical list of the 38 current districts of Tamil Nadu.
 *
 * Verified against the Tamil Nadu government district portal
 * (https://www.tn.gov.in/districts) — 38 districts as of the 2019–2020
 * reorganisation (Chengalpattu, Kallakurichi, Ranipet, Tenkasi, Tirupathur
 * and Mayiladuthurai being the most recently created).
 *
 * This array is the single source of truth. Order is alphabetical for
 * readability only; nothing should depend on it.
 */
export const CANONICAL_DISTRICTS = [
  "Ariyalur",
  "Chengalpattu",
  "Chennai",
  "Coimbatore",
  "Cuddalore",
  "Dharmapuri",
  "Dindigul",
  "Erode",
  "Kallakurichi",
  "Kancheepuram",
  "Kanniyakumari",
  "Karur",
  "Krishnagiri",
  "Madurai",
  "Mayiladuthurai",
  "Nagapattinam",
  "Namakkal",
  "The Nilgiris",
  "Perambalur",
  "Pudukkottai",
  "Ramanathapuram",
  "Ranipet",
  "Salem",
  "Sivagangai",
  "Tenkasi",
  "Thanjavur",
  "Theni",
  "Thiruvallur",
  "Thiruvarur",
  "Thoothukudi",
  "Tiruchirappalli",
  "Tirunelveli",
  "Tirupathur",
  "Tiruppur",
  "Tiruvannamalai",
  "Vellore",
  "Viluppuram",
  "Virudhunagar",
] as const

export type CanonicalDistrictName = (typeof CANONICAL_DISTRICTS)[number]

/** Alias name is also referred to as DistrictName across the data model. */
export type DistrictName = CanonicalDistrictName

const CANONICAL_SET = new Set<string>(CANONICAL_DISTRICTS)

/** Lower-cased canonical name -> canonical name, for case-insensitive direct hits. */
const CANONICAL_BY_KEY = new Map<string, CanonicalDistrictName>(
  CANONICAL_DISTRICTS.map((name) => [normalizeKey(name), name]),
)

/** alias key (already normalized) -> canonical name. */
const ALIAS_BY_KEY = new Map<string, CanonicalDistrictName>(
  Object.entries(aliasData.aliases).flatMap(([alias, canonical]) => {
    // Guard: every alias target must itself be canonical, else the alias file
    // is wrong. We throw at module load so tests / build fail loudly.
    if (!CANONICAL_SET.has(canonical)) {
      throw new Error(
        `district-aliases.json maps "${alias}" to non-canonical "${canonical}"`,
      )
    }
    return [[normalizeKey(alias), canonical as CanonicalDistrictName]]
  }),
)

/**
 * Normalise a raw string to a comparison key: trim, collapse internal
 * whitespace, strip the surrounding district/dist qualifiers and lower-case.
 * Diacritics are stripped so e.g. "Thiruvārūr" matches "thiruvarur".
 */
function normalizeKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // strip combining diacritics (accents)
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/\bdist\.?\b/g, "")
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Resolve a raw district name (from GeoJSON, Wikidata, user input, …) to its
 * canonical Tamil Nadu district name.
 *
 * Returns `null` when the name cannot be confidently resolved. Callers MUST
 * treat `null` as "unresolved" and never guess — per the project data rules.
 */
export function normalizeDistrictName(
  name: string | null | undefined,
): CanonicalDistrictName | null {
  if (!name) return null
  const key = normalizeKey(name)
  if (!key) return null
  return CANONICAL_BY_KEY.get(key) ?? ALIAS_BY_KEY.get(key) ?? null
}

/** True when `name` is exactly one of the 38 canonical district names. */
export function isCanonicalDistrict(name: string): name is CanonicalDistrictName {
  return CANONICAL_SET.has(name)
}
