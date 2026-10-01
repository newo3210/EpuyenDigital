import type { Instrumentation } from 'next';

// Server error hook - stores unhandled render/action/route errors (Node runtime only; Edge has no admin client).
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { toRequestErrorLog } = await import('@/features/errors/request-error');
  const input = toRequestErrorLog(error, request, context);
  if (!input) return;

  const { logServerError } = await import('@/features/errors/server');
  await logServerError(input);
};
