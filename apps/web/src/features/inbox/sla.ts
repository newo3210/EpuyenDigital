import type { SlaStatus } from '@/contracts/inbox';

export type SlaAreaMinutes = {
  warningMinutes: number | null;
  criticalMinutes: number | null;
};

export type BusinessHoursRange = { start: string; end: string };
export type BusinessHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', BusinessHoursRange[]>
>;

const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function dayKeyInTz(date: Date, timeZone: string): (typeof DOW_KEYS)[number] {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, (typeof DOW_KEYS)[number]> = {
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
    Sun: 'sun',
  };
  return map[weekday] ?? 'mon';
}

function ymdInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function zonedParts(date: Date, timeZone: string): { ymd: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

// businessMinutesBetween - counts only configured ranges; empty hours → calendar minutes.
export function businessMinutesBetween(params: {
  from: Date;
  to: Date;
  businessHours?: BusinessHours | null;
  holidays?: string[] | null;
  timeZone?: string;
}): number {
  const { from, to } = params;
  if (!(to > from)) return 0;
  const timeZone = params.timeZone ?? 'America/Argentina/Buenos_Aires';
  const hours = params.businessHours ?? {};
  const hasRanges = DOW_KEYS.some((k) => (hours[k]?.length ?? 0) > 0);
  if (!hasRanges) {
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
  }

  const holidays = new Set(params.holidays ?? []);
  let total = 0;
  const cursor = new Date(from.getTime());
  // Walk calendar days in org TZ by advancing 24h from local midnight approximations.
  let guard = 0;
  while (cursor < to && guard < 400) {
    guard += 1;
    const key = dayKeyInTz(cursor, timeZone);
    const ymd = ymdInTz(cursor, timeZone);
    if (holidays.has(ymd)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }
    const ranges = hours[key] ?? [];
    const dayParts = zonedParts(cursor, timeZone);
    for (const range of ranges) {
      const startMin = parseHm(range.start);
      const endMin = parseHm(range.end);
      if (startMin == null || endMin == null || endMin <= startMin) continue;
      const segStart = Math.max(dayParts.minutes, startMin);
      // Compare against `to` in same local day minutes when same ymd.
      const toParts = zonedParts(to, timeZone);
      const endCap = toParts.ymd === ymd ? Math.min(toParts.minutes, endMin) : endMin;
      const fromParts = zonedParts(from, timeZone);
      const startCap = fromParts.ymd === ymd ? Math.max(fromParts.minutes, startMin) : startMin;
      const localStart = Math.max(segStart, startCap);
      const localEnd = endCap;
      if (localEnd > localStart) total += localEnd - localStart;
    }
    // Advance to next local day: jump ~26h then snap via day key change.
    cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return total;
}

// computeSlaStatus - ok / warning / critical from area minutes + business elapsed.
export function computeSlaStatus(params: {
  enteredQueueAt: string | Date;
  now?: Date;
  area: SlaAreaMinutes;
  businessHours?: BusinessHours | null;
  holidays?: string[] | null;
  timeZone?: string;
  resolved?: boolean;
}): SlaStatus {
  if (params.resolved) return 'ok';
  const { warningMinutes, criticalMinutes } = params.area;
  if (warningMinutes == null && criticalMinutes == null) return 'ok';

  const from = params.enteredQueueAt instanceof Date
    ? params.enteredQueueAt
    : new Date(params.enteredQueueAt);
  const to = params.now ?? new Date();
  const elapsed = businessMinutesBetween({
    from,
    to,
    businessHours: params.businessHours,
    holidays: params.holidays,
    timeZone: params.timeZone,
  });

  if (criticalMinutes != null && elapsed >= criticalMinutes) return 'critical';
  if (warningMinutes != null && elapsed >= warningMinutes) return 'warning';
  return 'ok';
}
