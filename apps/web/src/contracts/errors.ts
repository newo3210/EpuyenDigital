import { z } from 'zod';
import { errorLevelSchema, errorSourceSchema, errorStatusSchema, traceIdSchema } from '@epuyen/shared';

// Client report body - unhandled UI error sent by the error boundaries.
export const errorReportSchema = z.object({
  traceId: traceIdSchema,
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500),
  note: z.string().max(500).optional(),
  digest: z.string().max(200).optional(),
});

export type ErrorReportInput = z.infer<typeof errorReportSchema>;

// Status change - support action on one incident.
export const errorStatusChangeSchema = z.object({
  id: z.string().uuid(),
  status: errorStatusSchema,
});

export type ErrorStatusChangeInput = z.infer<typeof errorStatusChangeSchema>;

// Calendar check - the date must survive a UTC round trip (rejects 2026-02-31, month 13, etc.).
function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Support filters - query-string values; anything invalid is dropped instead of rejected.
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate);

export const errorFiltersSchema = z.object({
  status: errorStatusSchema.optional().catch(undefined),
  source: errorSourceSchema.optional().catch(undefined),
  level: errorLevelSchema.optional().catch(undefined),
  from: dateOnlySchema.optional().catch(undefined),
  to: dateOnlySchema.optional().catch(undefined),
  id: z.string().uuid().optional().catch(undefined),
});

export type ErrorFilters = z.infer<typeof errorFiltersSchema>;
