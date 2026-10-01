import type { ErrorFilters } from '@/contracts/errors';
import type { ErrorLogFilters } from '@/infrastructure/repositories/error-logs';

// Argentina offset - America/Argentina/Buenos_Aires is fixed UTC-3 (no DST).
const AR_OFFSET = '-03:00';

// Filter mapping - support query filters to repository filters with inclusive local-day bounds.
export function toLogFilters(filters: ErrorFilters): ErrorLogFilters {
  const result: ErrorLogFilters = {};
  if (filters.status) result.status = filters.status;
  if (filters.source) result.source = filters.source;
  if (filters.level) result.level = filters.level;
  if (filters.from) result.from = `${filters.from}T00:00:00.000${AR_OFFSET}`;
  if (filters.to) result.to = `${filters.to}T23:59:59.999${AR_OFFSET}`;
  return result;
}
