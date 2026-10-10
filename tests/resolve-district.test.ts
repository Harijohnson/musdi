import { expect, test, describe } from "bun:test"
import { resolveDistrict } from "../lib/geo/resolve-district"

describe("resolveDistrict precedence", () => {
  test("a reviewed manual override wins over every automated strategy", () => {
    const r = resolveDistrict({
      override: { birthplaceDistrict: "Madurai", reviewed: true },
      ancestorDistrict: "Chennai",
      coords: { lat: 13.08, lon: 80.27 },
      resolvePoint: () => "Chennai",
      ownNameDistrict: "Salem",
      birthName: "Erode",
    })
    expect(r.district).toBe("Madurai")
    expect(r.method).toBe("manual-override")
    expect(r.confidence).toBe("manual")
  })

  test("an unreviewed override is ignored", () => {
    const r = resolveDistrict({
      override: { birthplaceDistrict: "Madurai", reviewed: false },
      ancestorDistrict: "Chennai",
    })
    expect(r.district).toBe("Chennai")
    expect(r.method).toBe("wikidata-administrative-hierarchy")
  })

  test("admin hierarchy beats geo and name mapping", () => {
    const r = resolveDistrict({
      ancestorDistrict: "Thanjavur",
      coords: { lat: 13.08, lon: 80.27 },
      resolvePoint: () => "Chennai",
      ownNameDistrict: "Salem",
    })
    expect(r.district).toBe("Thanjavur")
    expect(r.confidence).toBe("high")
  })

  test("geo point-in-polygon used when no admin hierarchy", () => {
    const r = resolveDistrict({
      coords: { lat: 9.925, lon: 78.119 },
      resolvePoint: (lat, lon) => (lat === 9.925 && lon === 78.119 ? "Madurai" : null),
    })
    expect(r.district).toBe("Madurai")
    expect(r.method).toBe("geo-point-in-polygon")
  })

  test("place-name mapping as fallback", () => {
    const r = resolveDistrict({ birthName: "Trichy" })
    expect(r.district).toBe("Tiruchirappalli")
    expect(r.method).toBe("place-mapping")
    expect(r.confidence).toBe("medium")
  })

  test("unresolved stays null — never guessed", () => {
    const r = resolveDistrict({ birthName: "Some Unknown Village" })
    expect(r.district).toBeNull()
    expect(r.method).toBe("unresolved")
  })
})
