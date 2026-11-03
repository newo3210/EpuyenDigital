import { describe, expect, it } from "vitest";
import { verifyWebhookSecret } from "./webhook-secret.js";

describe("verifyWebhookSecret", () => {
  it("returns 503 when secret not configured", () => {
    expect(verifyWebhookSecret(undefined, "x")).toEqual({
      ok: false,
      status: 503,
      code: "SECRET_NOT_CONFIGURED",
    });
  });

  it("returns 401 on missing or wrong secret", () => {
    const missing = verifyWebhookSecret("secret", undefined);
    const wrong = verifyWebhookSecret("secret", "nope");
    expect(missing.ok).toBe(false);
    expect(wrong.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(401);
    if (!wrong.ok) expect(wrong.status).toBe(401);
  });

  it("accepts matching secret", () => {
    expect(verifyWebhookSecret("secret", "secret")).toEqual({ ok: true });
  });
});
