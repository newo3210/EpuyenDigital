import { parseEnv } from "@epuyen/shared";
import { HttpEvolutionClient, MemoryEvolutionClient } from "./infrastructure/evolution/client.js";
import {
  MemoryVisionClient,
  OpenAiCompatibleVisionClient,
} from "./infrastructure/llm/vision-client.js";
import { MemoryWorkerStore } from "./infrastructure/memory-store.js";
import { createSupabaseWorkerStore } from "./infrastructure/supabase-store.js";
import { runWorkerLoop } from "./jobs/consumer.js";
import type { JobContext } from "./jobs/types.js";
import type { WorkerStore } from "./infrastructure/store.js";

// Worker entry - poll jobs and dispatch registration handlers

async function main() {
  const env = parseEnv(process.env);
  const store: WorkerStore =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseWorkerStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : new MemoryWorkerStore();
  // SQL-backed store when SUPABASE_* is set; otherwise in-memory for local dry runs.

  const evolution =
    env.EVOLUTION_BASE_URL && env.EVOLUTION_API_KEY
      ? new HttpEvolutionClient(env.EVOLUTION_BASE_URL, env.EVOLUTION_API_KEY)
      : new MemoryEvolutionClient();

  const vision =
    env.LLM_VISION_API_KEY && env.LLM_VISION_BASE_URL
      ? new OpenAiCompatibleVisionClient({
          baseUrl: env.LLM_VISION_BASE_URL,
          apiKey: env.LLM_VISION_API_KEY,
          model: env.LLM_VISION_MODEL,
          timeoutMs: env.LLM_VISION_TIMEOUT_MS,
        })
      : new MemoryVisionClient(() => ({
          summary: "pending",
          colors: [],
          markings: [],
          notableFeatures: [],
        }));

  const ctx: JobContext = {
    store,
    evolution,
    vision,
    petRegistryEnabled: env.PET_REGISTRY_BOT_ENABLED,
    defaultSendMode: env.SEND_MODE,
    defaultAllowlist: env.ALLOWLIST_PHONES,
  };

  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  process.on("SIGTERM", () => controller.abort());

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      msg: "worker_started",
      sendMode: env.SEND_MODE,
      linePhone: env.INSPECTORIA_DISPLAY_PHONE,
    }),
  );

  await runWorkerLoop(ctx, { pollMs: env.WORKER_POLL_MS, signal: controller.signal });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
