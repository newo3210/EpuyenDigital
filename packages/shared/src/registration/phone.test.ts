import { describe, expect, it } from "vitest";
import { normalizePhone, redactPhone } from "./phone.js";

describe("normalizePhone", () => {
  it("normalizes +54 9 2944… to 5492944…", () => {
    expect(normalizePhone("+54 9 2944 216586")).toBe("5492944216586");
  });

  it("keeps already canonical 549…", () => {
    expect(normalizePhone("5492944216586")).toBe("5492944216586");
  });

  it("inserts mobile 9 when missing after 54", () => {
    expect(normalizePhone("542944216586")).toBe("5492944216586");
  });

  it("strips spaces and dashes", () => {
    expect(normalizePhone("54-9-2944-216586")).toBe("5492944216586");
  });
});

describe("redactPhone", () => {
  it("masks middle digits", () => {
    expect(redactPhone("5492944216586")).toBe("549***586");
  });
});
