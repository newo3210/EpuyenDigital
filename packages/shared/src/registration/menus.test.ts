import { describe, expect, it } from "vitest";
import {
  parseHealthCardSkip,
  parseLocationHelpChoice,
  parseLocationSkip,
  parsePhotoFinish,
  parseRabiesStatus,
  parseSex,
  parseSize,
  parseSpecies,
  parseSterilized,
  RABIES_MENU_LINES,
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

  it("parses sex size sterilized rabies including unknown", () => {
    expect(parseSex("Macho")).toBe("male");
    expect(parseSize("2")).toBe("medium");
    expect(parseSterilized("No sé")).toBe("unknown");
    expect(parseRabiesStatus("Al día")).toBe("up_to_date");
    expect(parseRabiesStatus("3")).toBe("unknown");
    expect(parseRabiesStatus("No sé")).toBe("unknown");
    expect(RABIES_MENU_LINES.join(" ")).toMatch(/No sé/);
  });

  it("parses location help, skip, health No, and photo finish", () => {
    expect(parseLocationHelpChoice("1")).toBe("help");
    expect(parseLocationHelpChoice("2")).toBe("skip_help");
    expect(parseLocationSkip("No puedo ahora")).toBe(true);
    expect(parseHealthCardSkip("No")).toBe(true);
    expect(parsePhotoFinish("listo")).toBe("finish");
    expect(parsePhotoFinish("OK")).toBe("finish");
  });
});
