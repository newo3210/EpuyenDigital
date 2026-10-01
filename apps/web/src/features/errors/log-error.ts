import { redactDetails, redactText, type ErrorLevel, type ErrorSource } from '@epuyen/shared';

import type { NewErrorLog } from '@/infrastructure/repositories/error-logs';

// Message limit - stored messages are capped after redaction.
export const MAX_MESSAGE_CHARS = 2000;

// Log input - incident data before redaction; org/user optional for anonymous failures.
export type LogErrorInput = {
  source: ErrorSource;
  level?: ErrorLevel;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
  orgId?: string | null;
  userId?: string | null;
};

// Log ports - service-role insert and last-resort console fallback.
export type LogErrorDeps = {
  insert: (row: NewErrorLog) => Promise<string>;
  fallback: (message: string, data: unknown) => void;
};

// Details normalizer - redacted details always stored as a JSON object.
function toDetailsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return value === undefined ? {} : { value };
}

// Redacted row builder - masks message and details before anything leaves the process.
function buildRow(input: LogErrorInput): NewErrorLog {
  return {
    source: input.source,
    level: input.level ?? 'error',
    message: redactText(input.message).slice(0, MAX_MESSAGE_CHARS),
    details: toDetailsObject(redactDetails(input.details ?? {})),
    traceId: input.traceId,
    orgId: input.orgId ?? null,
    userId: input.userId ?? null,
  };
}

// Error logger - stores a redacted incident and never throws; returns the id or null.
export async function logError(input: LogErrorInput, deps: LogErrorDeps): Promise<string | null> {
  let row: NewErrorLog | null = null;
  try {
    row = buildRow(input);
    return await deps.insert(row);
  } catch (cause) {
    try {
      deps.fallback('error_logs insert failed', {
        row,
        cause: cause instanceof Error ? redactText(cause.message) : 'unknown',
      });
    } catch {
      // Fallback unavailable - swallow so logging never breaks the caller.
    }
    return null;
  }
}
