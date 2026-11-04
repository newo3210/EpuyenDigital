import type { ErrorStatus } from '@epuyen/shared';
import type { ErrorFilters } from '@/contracts/errors';

const BASE_PATH = '/support/errors';

// Date formatter - es-AR short date + time in Argentina time.
const DATE_TIME = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Argentina/Buenos_Aires',
});

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

// Link builders - keep the active filters when opening or closing the detail panel.
function hrefWith(filters: ErrorFilters, id?: string): string {
  const params = new URLSearchParams();
  for (const key of ['status', 'source', 'level', 'from', 'to'] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (id) params.set('id', id);
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}

export const detailHref = (filters: ErrorFilters, id: string) => hrefWith(filters, id);
export const closeDetailHref = (filters: ErrorFilters) => hrefWith(filters);

// Status badge styles - open (danger), acknowledged (notice), resolved (brand).
export const STATUS_BADGE_CLASS: Record<ErrorStatus, string> = {
  open: 'bg-danger-soft text-danger',
  acknowledged: 'bg-notice-soft text-notice',
  resolved: 'bg-brand-50 text-brand-700',
};
