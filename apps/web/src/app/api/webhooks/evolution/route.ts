import { NextResponse } from "next/server";
import { parseEnv } from "@epuyen/shared";
import {
  ingestDeliveryAck,
  ingestInboundEvent,
  MemoryInboundStore,
  type InboundStore,
} from "@/infrastructure/inbound-repository";
import { normalizeEvolutionPayload } from "@/infrastructure/normalize-evolution";
import { getSupabaseInboundStore } from "@/infrastructure/supabase-inbound-store";
import { verifyWebhookSecret } from "@/infrastructure/webhook-secret";

// Evolution webhook - thin: Zod normalize + line secret + persist/enqueue only

const memoryFallback = new MemoryInboundStore();

const SECRET_CONFIG_CODES = new Set([
  "CREDENTIALS_ENCRYPTION_KEY_MISSING",
  "CREDENTIALS_ENCRYPTION_KEY_INVALID",
  "CIPHERTEXT_FORMAT_INVALID",
  "SECRET_DECRYPT_FAILED",
]);

function isSecretConfigError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return SECRET_CONFIG_CODES.has(error.message) || error.name === "CredentialsKeyError";
}

function resolveStore() {
  try {
    const env = parseEnv(process.env);
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      return getSupabaseInboundStore();
    }
  } catch {
    // fall through to memory for local fixture tests without DB
  }
  // Seed default line for dry local runs without Supabase
  // Line webhookSecret is source of truth; seed from env when present for local MVP
  if (!memoryFallback.lines.has("inspectoria")) {
    memoryFallback.lines.set("inspectoria", {
      lineId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      instance: "inspectoria",
      webhookSecret: process.env.WEBHOOK_SECRET ?? null,
      defaultAreaId: "00000000-0000-4000-8000-000000000010",
    });
  }
  return memoryFallback;
}

// authenticateWebhook - instance → line → secret before any ignored/persist response
async function authenticateWebhook(
  store: InboundStore,
  instance: string,
  provided: string | null | undefined,
): Promise<
  | { ok: true }
  | { ok: false; httpStatus: number; body: Record<string, unknown> }
> {
  try {
    const line = await store.findLineByInstance(instance);
    if (!line) {
      return { ok: false, httpStatus: 404, body: { ok: false, code: "LINE_NOT_FOUND" } };
    }
    const secretCheck = verifyWebhookSecret(line.webhookSecret, provided);
    if (!secretCheck.ok) {
      return {
        ok: false,
        httpStatus: secretCheck.status,
        body: { ok: false, code: secretCheck.code },
      };
    }
    return { ok: true };
  } catch (error) {
    if (isSecretConfigError(error)) {
      return {
        ok: false,
        httpStatus: 503,
        body: { ok: false, code: "SECRET_NOT_CONFIGURED" },
      };
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-evolution-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON" }, { status: 400 });
  }

  const normalized = normalizeEvolutionPayload(raw);
  const store = resolveStore();

  // WA-03: authenticate before ignore short-circuit (groups/broadcasts/invalid)
  const auth = await authenticateWebhook(store, normalized.instance, provided);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.httpStatus });
  }

  if (normalized.ignored) {
    return NextResponse.json({ ok: true, ignored: true, reason: normalized.reason });
  }

  try {
    if (normalized.deliveryAck) {
      const result = await ingestDeliveryAck(store, normalized.deliveryAck, provided);
      return NextResponse.json(result.body, { status: result.httpStatus });
    }

    // Secret verified against line.webhookSecret after resolve (see ingestInboundEvent)
    const result = await ingestInboundEvent(store, normalized.event!, provided);
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (error) {
    if (isSecretConfigError(error)) {
      return NextResponse.json(
        { ok: false, code: "SECRET_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    throw error;
  }
}
