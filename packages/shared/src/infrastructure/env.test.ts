import { describe, expect, it } from "vitest";
import { parseEnv, safeParseEnv } from "./env.js";

// Env tests - defaults and validation for boot configuration
describe("parseEnv", () => {
  it("applies dry_run and Inspectoría phone defaults", () => {
    const env = parseEnv({});
    expect(env.SEND_MODE).toBe("dry_run");
    expect(env.INSPECTORIA_DISPLAY_PHONE).toBe("+5492944216586");
    expect(env.REGISTRATION_SESSION_TTL_HOURS).toBe(24);
    expect(env.PET_REGISTRY_BOT_ENABLED).toBe(true);
  });

  it("parses allowlist phones as normalized list", () => {
    const env = parseEnv({
      SEND_MODE: "allowlist",
      ALLOWLIST_PHONES: "5492944216586, 5491111111111",
    });
    expect(env.SEND_MODE).toBe("allowlist");
    expect(env.ALLOWLIST_PHONES).toEqual(["5492944216586", "5491111111111"]);
  });

  it("rejects invalid send mode via safeParse", () => {
    const result = safeParseEnv({ SEND_MODE: "yes" });
    expect(result.success).toBe(false);
  });
});
