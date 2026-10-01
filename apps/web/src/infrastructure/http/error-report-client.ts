import { TRACE_HEADER } from '@epuyen/shared';

import type { ErrorReportInput } from '@/contracts/errors';

// Report endpoint - same-origin route handler that stores web errors.
export const ERROR_REPORT_ENDPOINT = '/api/errors/report';

// Report sender - trace id in header and body (must match); never throws, returns delivery success.
export async function sendErrorReport(report: ErrorReportInput): Promise<boolean> {
  try {
    const response = await fetch(ERROR_REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [TRACE_HEADER]: report.traceId },
      body: JSON.stringify(report),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
