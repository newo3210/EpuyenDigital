import { describe, expect, it } from "vitest";
import {
  parseConsentAccept,
  parsePhotoFinish,
  parseRabiesStatus,
  parseSex,
  parseSize,
  parseSpecies,
  parseSterilized,
  SPECIES_MENU_LINES,
} from "./menus.js";

describe("menu parsers", () => {
  it("parses species by number and label", () => {
    expect(parseSpecies("1")).toBe("dog");
    expect(parseSpecies("Gato")).toBe("cat");
    expect(parseSpecies("Otro")).toBe("other");
    expect(parseSpecies("Caballo")).toBeNull();
  });

  it("does not offer horse in species menu", () => {
    expect(SPECIES_MENU_LINES.join(" ")).not.toMatch(/caballo/i);
  });

  it("parses sex size sterilized rabies", () => {
    expect(parseSex("Macho")).toBe("male");
    expect(parseSize("2")).toBe("medium");
    expect(parseSterilized("No sé")).toBe("unknown");
    expect(parseRabiesStatus("Al día")).toBe("up_to_date");
  });

  it("parses consent and photo finish", () => {
    expect(parseConsentAccept("Acepto")).toBe(true);
    expect(parsePhotoFinish("listo")).toBe("finish");
    expect(parsePhotoFinish("otra")).toBe("another");
  });
});
