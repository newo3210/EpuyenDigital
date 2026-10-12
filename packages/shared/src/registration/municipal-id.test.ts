import { describe, expect, it } from "vitest";
import {
  formatMunicipalId,
  normalizeBarrioCode,
  registrationYearBuenosAires,
} from "./municipal-id.js";

describe("normalizeBarrioCode", () => {
  it("uppercases and trims to 3–4 chars", () => {
    expect(normalizeBarrioCode("centro")).toBe("CENT");
    expect(normalizeBarrioCode("EPU")).toBe("EPU");
  });

  it("returns null for short or empty", () => {
    expect(normalizeBarrioCode("ab")).toBeNull();
    expect(normalizeBarrioCode("")).toBeNull();
  });
});

describe("formatMunicipalId", () => {
  it("formats known barrio sequence", () => {
    expect(
      formatMunicipalId({ barrioCode: "CENT", year: 2026, sequence: 482 }),
    ).toBe("CENT-2026-00482");
  });

  it("falls back to EPU", () => {
    expect(
      formatMunicipalId({ barrioCode: null, year: 2026, sequence: 1 }),
    ).toBe("EPU-2026-00001");
  });

  it("uses EPU when neighborhood/barrio is empty (UX v2)", () => {
    expect(
      formatMunicipalId({ barrioCode: "", year: 2026, sequence: 12 }),
    ).toBe("EPU-2026-00012");
    expect(
      formatMunicipalId({ barrioCode: undefined, year: 2026, sequence: 3 }),
    ).toBe("EPU-2026-00003");
  });
});

describe("registrationYearBuenosAires", () => {
  it("returns a four-digit year", () => {
    expect(registrationYearBuenosAires(new Date("2026-06-15T12:00:00Z"))).toBe(2026);
  });
});
