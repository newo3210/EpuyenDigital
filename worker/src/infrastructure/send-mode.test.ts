import { describe, expect, it } from "vitest";
import { decideSend } from "./send-mode.js";

describe("decideSend", () => {
  it("blocks dry_run", () => {
    expect(decideSend({ mode: "dry_run", phone: "5491", allowlist: [] }).allowed).toBe(
      false,
    );
  });

  it("blocks unknown phones on allowlist", () => {
    const d = decideSend({
      mode: "allowlist",
      phone: "5490000000000",
      allowlist: ["5492944216586"],
    });
    expect(d).toEqual({ allowed: false, reason: "not_allowlisted" });
  });

  it("allows production and allowlisted", () => {
    expect(
      decideSend({
        mode: "allowlist",
        phone: "5492944216586",
        allowlist: ["5492944216586"],
      }).allowed,
    ).toBe(true);
    expect(
      decideSend({ mode: "production", phone: "5490000000000", allowlist: [] }).allowed,
    ).toBe(true);
  });
});
