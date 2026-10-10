import { expect, test, describe } from "bun:test"
import {
  normalizeDistrictName,
  isCanonicalDistrict,
  CANONICAL_DISTRICTS,
} from "../lib/geo/district-normalizer"

describe("normalizeDistrictName", () => {
  test("accepts canonical names as-is", () => {
    for (const d of CANONICAL_DISTRICTS) {
      expect(normalizeDistrictName(d)).toBe(d)
    }
  })

  test("resolves common alternate spellings", () => {
    expect(normalizeDistrictName("Kanchipuram")).toBe("Kancheepuram")
    expect(normalizeDistrictName("Kancheepuram")).toBe("Kancheepuram")
    expect(normalizeDistrictName("Kanyakumari")).toBe("Kanniyakumari")
    expect(normalizeDistrictName("Pudukottai")).toBe("Pudukkottai")
    expect(normalizeDistrictName("Sivaganga")).toBe("Sivagangai")
    expect(normalizeDistrictName("Tiruvallur")).toBe("Thiruvallur")
    expect(normalizeDistrictName("Tiruvarur")).toBe("Thiruvarur")
    expect(normalizeDistrictName("Tirupattur")).toBe("Tirupathur")
    expect(normalizeDistrictName("Villupuram")).toBe("Viluppuram")
    expect(normalizeDistrictName("Trichy")).toBe("Tiruchirappalli")
    expect(normalizeDistrictName("Tiruchirapalli")).toBe("Tiruchirappalli")
    expect(normalizeDistrictName("Nilgiris")).toBe("The Nilgiris")
    expect(normalizeDistrictName("Tuticorin")).toBe("Thoothukudi")
  })

  test("is case- and whitespace-insensitive", () => {
    expect(normalizeDistrictName("  MADURAI  ")).toBe("Madurai")
    expect(normalizeDistrictName("the nilgiris")).toBe("The Nilgiris")
    expect(normalizeDistrictName("Chennai District")).toBe("Chennai")
    expect(normalizeDistrictName("Salem dist.")).toBe("Salem")
  })

  test("strips diacritics", () => {
    expect(normalizeDistrictName("Thiruvārūr")).toBe("Thiruvarur")
  })

  test("returns null for unresolvable / empty input", () => {
    expect(normalizeDistrictName("Some Random Village")).toBeNull()
    expect(normalizeDistrictName("")).toBeNull()
    expect(normalizeDistrictName(null)).toBeNull()
    expect(normalizeDistrictName(undefined)).toBeNull()
    expect(normalizeDistrictName("Bangalore")).toBeNull()
  })
})

describe("isCanonicalDistrict", () => {
  test("recognises exactly the 38 canonical names", () => {
    expect(CANONICAL_DISTRICTS.length).toBe(38)
    expect(isCanonicalDistrict("Madurai")).toBe(true)
    expect(isCanonicalDistrict("Kanchipuram")).toBe(false) // alias, not canonical
    expect(isCanonicalDistrict("Nowhere")).toBe(false)
  })

  test("canonical list has no duplicates", () => {
    expect(new Set(CANONICAL_DISTRICTS).size).toBe(38)
  })
})
