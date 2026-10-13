import { timingSafeEqual } from "node:crypto";

// Webhook secret - constant-time verify for Evolution inbound

export type SecretCheckResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: "UNAUTHORIZED" | "SECRET_NOT_CONFIGURED" };

// verifyWebhookSecret - fail closed when secret missing; 401 on mismatch
export function verifyWebhookSecret(
  configuredSecret: string | undefined | null,
  providedSecret: string | undefined | null,
): SecretCheckResult {
  if (!configuredSecret || configuredSecret.length === 0) {
    return { ok: false, status: 503, code: "SECRET_NOT_CONFIGURED" };
  }
  if (!providedSecret || providedSecret.length === 0) {
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }

  const a = Buffer.from(configuredSecret);
  const b = Buffer.from(providedSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }
  return { ok: true };
}
