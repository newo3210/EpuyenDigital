import type { Instrumentation } from 'next';

// Server error hook - stores unhandled render/action/route errors (Node runtime only; Edge has no admin client).
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { toRequestErrorLog } = await import('@/features/errors/request-error');
  const input = toRequestErrorLog(error, request, context);
  if (!input) return;

  const { attachRequestOperator } = await import('@/features/errors/attach-operator');
  const { logServerError, resolveOperatorFromCookieHeader } = await import('@/features/errors/server');
  const cookieHeader = request.headers.cookie;
  const enriched = await attachRequestOperator(input, Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader, {
    resolveOperator: resolveOperatorFromCookieHeader,
  });
  await logServerError(enriched);
};
