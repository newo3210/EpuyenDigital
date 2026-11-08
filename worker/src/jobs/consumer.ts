import { redactForLogs } from "../infrastructure/redact.js";
import { dispatchJob } from "./registry.js";
import type { JobContext } from "./types.js";

// Job consumer - claim with store (FOR UPDATE SKIP LOCKED in SQL impl) and dispatch

export async function processOneJob(ctx: JobContext): Promise<boolean> {
  const job = await ctx.store.claimNextJob();
  if (!job) return false;

  try {
    await dispatchJob(job.payload, ctx);
    await ctx.store.markJobDone(job.id);
  } catch (err) {
    const message = redactForLogs(err instanceof Error ? err.message : String(err));
    const retry = job.attempts < job.maxAttempts;
    await ctx.store.markJobFailed(job.id, message, retry);
  }
  return true;
}

// runWorkerLoop - poll until stopped. Abandon stale tasks about once a day when idle.
export async function runWorkerLoop(
  ctx: JobContext,
  options: { pollMs: number; signal?: AbortSignal },
): Promise<void> {
  let lastAbandonAt = 0;
  while (!options.signal?.aborted) {
    const did = await processOneJob(ctx);
    if (!did) {
      const now = Date.now();
      if (now - lastAbandonAt > 24 * 60 * 60 * 1000) {
        try {
          await ctx.store.abandonStaleTasks();
        } catch {
          // Local/memory stores and missing SQL stay quiet; the report documents the gap.
        }
        lastAbandonAt = now;
      }
      await new Promise((r) => setTimeout(r, options.pollMs));
    }
  }
}
