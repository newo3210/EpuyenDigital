/**
 * Local unified bot server — webhook + worker on one MemoryWorkerStore.
 * Use when Supabase/Docker full stack is unavailable. Outbound uses
 * MemoryEvolutionClient unless EVOLUTION_* is set (then HTTP Evolution).
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv, type EvolutionWebhook, type JobPayload } from "@epuyen/shared";
import { normalizeEvolutionPayload } from "../apps/web/src/infrastructure/normalize-evolution.ts";
import { verifyWebhookSecret } from "../apps/web/src/infrastructure/webhook-secret.ts";
import {
  HttpEvolutionClient,
  MemoryEvolutionClient,
} from "../worker/src/infrastructure/evolution/client.ts";
import { MemoryVisionClient } from "../worker/src/infrastructure/llm/vision-client.ts";
import { MemoryWorkerStore } from "../worker/src/infrastructure/memory-store.ts";
import { runWorkerLoop } from "../worker/src/jobs/consumer.ts";
import type { JobContext } from "../worker/src/jobs/types.ts";

// Boot config - port, secrets, asset path for location-help image
const env = parseEnv(process.env);
const port = Number(process.env.PORT ?? 3000);
const webhookSecret = process.env.WEBHOOK_SECRET ?? "dev-webhook-secret-change-me";
const defaultLocationHelpPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../worker/assets/inspectoria/location-help.png",
);

// Shared in-memory store - web ingest + worker jobs in one process
const store = new MemoryWorkerStore();
store.settings.sendMode = env.SEND_MODE;
store.settings.allowlistPhones =
  env.ALLOWLIST_PHONES.length > 0 ? env.ALLOWLIST_PHONES : ["5492944216586"];

const evolution =
  env.EVOLUTION_BASE_URL && env.EVOLUTION_API_KEY
    ? new HttpEvolutionClient(env.EVOLUTION_BASE_URL, env.EVOLUTION_API_KEY)
    : new MemoryEvolutionClient();

const ctx: JobContext = {
  store,
  evolution,
  vision: new MemoryVisionClient(() => ({
    summary: "pending",
    colors: [],
    markings: [],
    notableFeatures: [],
  })),
  petRegistryEnabled: env.PET_REGISTRY_BOT_ENABLED !== false,
  defaultSendMode: env.SEND_MODE,
  defaultAllowlist: store.settings.allowlistPhones,
  locationHelpImagePath: env.LOCATION_HELP_IMAGE_PATH ?? defaultLocationHelpPath,
};

// Ingest helpers - persist Evolution event and enqueue process_inbound
const seenExternal = new Map<string, string>();

async function ingest(event: EvolutionWebhook, providedSecret: string | null) {
  const secretCheck = verifyWebhookSecret(webhookSecret, providedSecret);
  if (!secretCheck.ok) {
    return { httpStatus: secretCheck.status, body: { ok: false, code: secretCheck.code } };
  }

  if (event.instance !== store.line.instance && event.instance !== "inspectoria") {
    return { httpStatus: 404, body: { ok: false, code: "LINE_NOT_FOUND" } };
  }

  const key = `${store.line.id}:${event.externalId}`;
  const existing = seenExternal.get(key);
  if (existing) {
    return {
      httpStatus: 200,
      body: { ok: true, duplicate: true, messageId: existing },
    };
  }

  if (event.fromMe) {
    const id = crypto.randomUUID();
    seenExternal.set(key, id);
    return {
      httpStatus: 200,
      body: { ok: true, ignored: true, reason: "from_me", messageId: id },
    };
  }

  const messageId = crypto.randomUUID();
  seenExternal.set(key, messageId);
  store.seedMessage({
    id: messageId,
    orgId: store.line.orgId,
    lineId: store.line.id,
    phoneNormalized: event.phoneNormalized,
    kind: event.kind,
    body: event.text ?? null,
    mediaUrl: event.mediaUrl ?? null,
    mediaMime: event.mediaMime ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    storagePath: null,
  });

  const payload: JobPayload = {
    type: "process_inbound",
    messageId,
    lineId: store.line.id,
    orgId: store.line.orgId,
  };
  await store.enqueueJob(store.line.orgId, payload);

  return {
    httpStatus: 200,
    body: { ok: true, duplicate: false, messageId },
  };
}

// HTTP server - health + Evolution webhook
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "epuyen-local-bot",
        feature: "inspectoria-pet-registry-bot",
        sendMode: store.settings.sendMode,
        evolution: env.EVOLUTION_BASE_URL ? "http" : "memory",
        outbounds: store.outbounds.length,
        sessions: store.sessions.size,
      }),
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/debug/outbounds") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ outbounds: store.outbounds.slice(-50) }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/webhooks/evolution") {
    const provided =
      (req.headers["x-webhook-secret"] as string | undefined) ??
      (req.headers["x-evolution-secret"] as string | undefined) ??
      (typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : null);

    let raw: unknown;
    try {
      raw = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, code: "INVALID_JSON" }));
      return;
    }

    const normalized = normalizeEvolutionPayload(raw);
    if (normalized.ignored) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ ok: true, ignored: true, reason: normalized.reason }),
      );
      return;
    }

    const result = await ingest(normalized.event!, provided ?? null);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        msg: "webhook_ingest",
        status: result.httpStatus,
        body: result.body,
        phone: normalized.event?.phoneNormalized,
        kind: normalized.event?.kind,
      }),
    );
    res.writeHead(result.httpStatus, { "content-type": "application/json" });
    res.end(JSON.stringify(result.body));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, code: "NOT_FOUND" }));
});

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

server.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      msg: "local_bot_started",
      port,
      sendMode: store.settings.sendMode,
      webhookSecretSet: Boolean(webhookSecret),
      evolution: env.EVOLUTION_BASE_URL ? "http" : "memory",
    }),
  );
});

void runWorkerLoop(ctx, { pollMs: env.WORKER_POLL_MS, signal: controller.signal }).then(
  () => {
    server.close();
    process.exit(0);
  },
);
