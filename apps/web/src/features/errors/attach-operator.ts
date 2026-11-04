import type { LogErrorInput } from './log-error';

// Request operator - org and user of the signed-in active operator behind a failing request.
export type RequestOperator = { orgId: string; userId: string };

// Attach ports - resolves the active operator from the raw request cookie header.
export type AttachOperatorDeps = {
  resolveOperator: (cookieHeader: string) => Promise<RequestOperator | null>;
};

// Operator enrichment - tags a server error with org/user when known; never throws, keeps null org otherwise.
export async function attachRequestOperator(
  input: LogErrorInput,
  cookieHeader: string | undefined,
  deps: AttachOperatorDeps,
): Promise<LogErrorInput> {
  if (!cookieHeader) return input;
  try {
    const operator = await deps.resolveOperator(cookieHeader);
    return operator ? { ...input, orgId: operator.orgId, userId: operator.userId } : input;
  } catch {
    return input;
  }
}
