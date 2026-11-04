// Trace constants - request header name and user-facing incident code length.
export const TRACE_HEADER = 'x-trace-id';
export const SHORT_CODE_LENGTH = 8;

// Accepted incoming ids - 8-64 safe characters (matches errorReportSchema bounds).
const SAFE_TRACE_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// Trace id generation - random UUID v4 (Web Crypto, available in Node and browsers).
export function generateTraceId(): string {
  return crypto.randomUUID();
}

// Incident code - first characters of the trace id, uppercased for readability.
export function shortCode(traceId: string): string {
  return traceId.slice(0, SHORT_CODE_LENGTH).toUpperCase();
}

// Header resolution - reuse a safe incoming id, otherwise generate a fresh one.
export function resolveTraceId(incoming: string | null | undefined): string {
  const candidate = incoming?.trim() ?? '';
  return SAFE_TRACE_ID_RE.test(candidate) ? candidate : generateTraceId();
}
