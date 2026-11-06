import { describe, expect, it } from "vitest";
import { decideSend } from "./send-mode.js";

describe("decideSend (shared)", () => {
  it("blocks dry_run without calling Evolution", () => {
    expect(
      decideSend({ mode: "dry_run", phone: "5492944216586", allowlist: [] }),
    ).toEqual({ allowed: false, reason: "dry_run" });
  });

  it("blocks phones missing from allowlist", () => {
    expect(
      decideSend({
        mode: "allowlist",
        phone: "5491111111111",
        allowlist: ["5492944216586"],
      }),
    ).toEqual({ allowed: false, reason: "not_allowlisted" });
  });

  it("allows allowlisted and production phones", () => {
    expect(
      decideSend({
        mode: "allowlist",
        phone: "5492944216586",
        allowlist: ["5492944216586"],
      }).allowed,
    ).toBe(true);
    expect(
      decideSend({
        mode: "production",
        phone: "5490000000000",
        allowlist: [],
      }).allowed,
    ).toBe(true);
  });
});
