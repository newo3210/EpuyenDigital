import type { JobPayload } from "@epuyen/shared";
import type { EvolutionClient } from "../infrastructure/evolution/client.js";
import type { VisionClient } from "../infrastructure/llm/vision-client.js";
import type { WorkerStore } from "../infrastructure/store.js";

// Job context - dependencies injected into handlers
export type JobContext = {
  store: WorkerStore;
  evolution: EvolutionClient;
  vision: VisionClient;
  petRegistryEnabled: boolean;
  defaultSendMode: "dry_run" | "allowlist" | "production";
  defaultAllowlist: string[];
  /** Absolute path to location-help PNG (env LOCATION_HELP_IMAGE_PATH or default asset) */
  locationHelpImagePath?: string;
};

export type JobHandler = (payload: JobPayload, ctx: JobContext) => Promise<void>;

export type JobRow = {
  id: string;
  job_type: string;
  payload: JobPayload;
  attempts: number;
  max_attempts: number;
};
