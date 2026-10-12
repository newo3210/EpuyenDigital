import type { JobPayload } from "@epuyen/shared";
import { handleAnalyzeTraits } from "./analyze-traits.js";
import { handleDownloadMedia } from "./download-media.js";
import { handleProcessInbound } from "./process-inbound.js";
import { handleSendOutbound } from "./send-outbound.js";
import type { JobContext, JobHandler } from "./types.js";

// Handlers registry - one handler per job_type

export const jobHandlers: Record<JobPayload["type"], JobHandler> = {
  process_inbound: handleProcessInbound,
  download_media: handleDownloadMedia,
  send_outbound: handleSendOutbound,
  analyze_traits: handleAnalyzeTraits,
};

// dispatchJob - route payload to handler
export async function dispatchJob(payload: JobPayload, ctx: JobContext): Promise<void> {
  const handler = jobHandlers[payload.type];
  if (!handler) {
    throw new Error(`UNKNOWN_JOB_TYPE:${payload.type}`);
  }
  await handler(payload, ctx);
}
