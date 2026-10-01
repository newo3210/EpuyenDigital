import { TRACE_HEADER, resolveTraceId } from '@epuyen/shared';

import type { LogErrorInput } from './log-error';

// Hook payloads - subset of Next's onRequestError request and context arguments.
export type RequestErrorInfo = {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

export type RequestErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

// Control-flow digests - redirect/notFound/forbidden are thrown by Next on purpose, not failures.
const CONTROL_FLOW_DIGEST_RE = /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/;

// Header reader - first value of a possibly repeated header.
function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Request error mapper - unhandled server error to a log input, or null for Next control flow.
export function toRequestErrorLog(
  error: unknown,
  request: RequestErrorInfo,
  context: RequestErrorContext,
): LogErrorInput | null {
  const digest = typeof error === 'object' && error && 'digest' in error ? String(error.digest) : undefined;
  if (digest && CONTROL_FLOW_DIGEST_RE.test(digest)) return null;

  return {
    source: context.routeType === 'route' ? 'api' : 'web',
    level: 'error',
    message: error instanceof Error ? error.message : String(error),
    details: {
      digest,
      stack: error instanceof Error ? error.stack : undefined,
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    },
    traceId: resolveTraceId(firstHeader(request.headers[TRACE_HEADER])),
  };
}
