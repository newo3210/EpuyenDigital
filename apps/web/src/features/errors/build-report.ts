import type { ErrorReportInput } from '@/contracts/errors';

// Report limits - mirror errorReportSchema so oversized browser errors are trimmed, not rejected.
const MESSAGE_MAX = 2000;
const STACK_MAX = 8000;
const URL_MAX = 500;

// Boundary error - Next passes a digest for errors that originated on the server.
export type BoundaryError = Error & { digest?: string };

// Report builder - browser error to a schema-sized report body.
export function buildErrorReport(error: BoundaryError, traceId: string, url: string, note?: string): ErrorReportInput {
  return {
    traceId,
    message: (error.message || error.name || 'Unknown error').slice(0, MESSAGE_MAX),
    stack: error.stack?.slice(0, STACK_MAX),
    url: url.slice(0, URL_MAX),
    note: note?.trim() ? note.trim() : undefined,
    digest: error.digest,
  };
}
