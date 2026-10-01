import { z } from 'zod';

// Error log enums - mirror the error_logs.source check and error_level / error_status types.
export const ERROR_SOURCES = ['web', 'api', 'worker', 'db'] as const;
export const ERROR_LEVELS = ['error', 'warn', 'info'] as const;
export const ERROR_STATUSES = ['open', 'acknowledged', 'resolved'] as const;

export const errorSourceSchema = z.enum(ERROR_SOURCES);
export const errorLevelSchema = z.enum(ERROR_LEVELS);
export const errorStatusSchema = z.enum(ERROR_STATUSES);

// Shared field schemas - trace id bounds and Postgres timestamptz strings.
export const traceIdSchema = z.string().min(8).max(64);
const timestampSchema = z.string().datetime({ offset: true });

// Error log entity - redacted incident row as listed on the support screen.
export const errorLogSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid().nullable(),
  source: errorSourceSchema,
  level: errorLevelSchema,
  message: z.string(),
  details: z.record(z.unknown()),
  traceId: traceIdSchema,
  userId: z.string().uuid().nullable(),
  status: errorStatusSchema,
  resolvedBy: z.string().uuid().nullable(),
  resolvedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type ErrorSource = z.infer<typeof errorSourceSchema>;
export type ErrorLevel = z.infer<typeof errorLevelSchema>;
export type ErrorStatus = z.infer<typeof errorStatusSchema>;
export type ErrorLog = z.infer<typeof errorLogSchema>;
