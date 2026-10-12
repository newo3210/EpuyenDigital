import { NextResponse } from "next/server";
import { parseEnv } from "@epuyen/shared";
import { ingestInboundEvent, MemoryInboundStore } from "@/infrastructure/inbound-repository";
import { normalizeEvolutionPayload } from "@/infrastructure/normalize-evolution";
import { verifyWebhookSecret } from "@/infrastructure/webhook-secret";
import { getSupabaseInboundStore } from "@/infrastructure/supabase-inbound-store";

// Evolution webhook - thin: secret + Zod normalize + persist/enqueue only

const memoryFallback = new MemoryInboundStore();

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
  if (!memoryFallback.lines.has("inspectoria")) {
    memoryFallback.lines.set("inspectoria", {
      lineId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      instance: "inspectoria",
      webhookSecret: process.env.WEBHOOK_SECRET ?? null,
    });
  }
  return memoryFallback;
}

export async function POST(request: Request) {
  const env = parseEnv(process.env);
  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-evolution-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const secretCheck = verifyWebhookSecret(env.WEBHOOK_SECRET, provided);
  if (!secretCheck.ok) {
    return NextResponse.json({ ok: false, code: secretCheck.code }, { status: secretCheck.status });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON" }, { status: 400 });
  }

  const normalized = normalizeEvolutionPayload(raw);
  if (normalized.ignored) {
    return NextResponse.json({ ok: true, ignored: true, reason: normalized.reason });
  }

  const store = resolveStore();
  const result = await ingestInboundEvent(store, normalized.event!);
  return NextResponse.json(result.body, { status: result.httpStatus });
}
