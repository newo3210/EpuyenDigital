import { z } from "zod";

// Env schema - validates process environment at boot boundaries
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PET_REGISTRY_BOT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
  WEBHOOK_SECRET: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  INSPECTORIA_DISPLAY_PHONE: z.string().default("+5492944216586"),
  EVOLUTION_BASE_URL: z.string().url().optional(),
  EVOLUTION_INSTANCE: z.string().default("inspectoria"),
  EVOLUTION_API_KEY: z.string().optional(),
  SEND_MODE: z.enum(["dry_run", "allowlist", "production"]).default("dry_run"),
  ALLOWLIST_PHONES: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  REGISTRATION_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PRIVACY_NOTICE_VERSION: z.string().default("v1"),
  LLM_VISION_PROVIDER: z.string().default("openai"),
  LLM_VISION_MODEL: z.string().default("gpt-4o-mini"),
  LLM_VISION_BASE_URL: z.string().url().optional(),
  LLM_VISION_API_KEY: z.string().optional(),
  LLM_VISION_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(1000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
});

export type AppEnv = z.infer<typeof envSchema>;

// parseEnv - parse and type process.env (or a provided record)
export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): AppEnv {
  return envSchema.parse(source);
}

// safeParseEnv - non-throwing parse for tests and boot diagnostics
export function safeParseEnv(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  return envSchema.safeParse(source);
}
