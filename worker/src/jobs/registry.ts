import type { JobPayload } from "@epuyen/shared";
import { handleAnalyzeTraits } from "./analyze-traits.js";
import { handleBotReply } from "./bot-reply.js";
import { handleDownloadMedia } from "./download-media.js";
import { handleExternalNotify } from "./external-notify.js";
import { handleIndexDocument } from "./index-document.js";
import { handleProcessInbound } from "./process-inbound.js";
import { handleSendOutbound } from "./send-outbound.js";
import { handleSummarizeMedia } from "./summarize-media.js";
import { handleTranscribeAudio } from "./transcribe-audio.js";
import type { JobContext, JobHandler } from "./types.js";

// Handlers registry - one handler per job_type

export const jobHandlers: Record<JobPayload["type"], JobHandler> = {
  process_inbound: handleProcessInbound,
  download_media: handleDownloadMedia,
  send_outbound: handleSendOutbound,
  analyze_traits: handleAnalyzeTraits,
  external_notify: handleExternalNotify,
  bot_reply: handleBotReply,
  index_document: handleIndexDocument,
  transcribe_audio: handleTranscribeAudio,
  summarize_media: handleSummarizeMedia,
};

// dispatchJob - route payload to handler
export async function dispatchJob(payload: JobPayload, ctx: JobContext): Promise<void> {
  const handler = jobHandlers[payload.type];
  if (!handler) {
    throw new Error(`UNKNOWN_JOB_TYPE:${payload.type}`);
  }
  await handler(payload, ctx);
}
