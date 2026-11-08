// Business calendar - weekly windows and holiday dates used by the SLA clock.
export type BusinessHours = {
  mon: [string, string][];
  tue: [string, string][];
  wed: [string, string][];
  thu: [string, string][];
  fri: [string, string][];
  sat: [string, string][];
  sun: [string, string][];
};

// Default municipal week - Mon–Fri 08:00–14:00, weekend closed.
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: [['08:00', '14:00']],
  tue: [['08:00', '14:00']],
  wed: [['08:00', '14:00']],
  thu: [['08:00', '14:00']],
  fri: [['08:00', '14:00']],
  sat: [],
  sun: [],
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

type Civil = {
  year: number;
  month: number;
  day: number;
  minutes: number;
  dow: number;
};

// Clock parts - civil time in the municipality timezone.
function toCivil(date: Date, timeZone: string): Civil {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    dow: weekday[parts.weekday ?? 'Sun'] ?? 0,
  };
}

// UTC instant - interpret a civil minute-of-day as an absolute timestamp.
function civilToUtc(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const civil = toCivil(new Date(guess), timeZone);
  const asUtc = Date.UTC(
    civil.year,
    civil.month - 1,
    civil.day,
    Math.floor(civil.minutes / 60),
    civil.minutes % 60,
  );
  return new Date(guess + (guess - asUtc));
}

function dateKey(civil: Civil): string {
  const month = String(civil.month).padStart(2, '0');
  const day = String(civil.day).padStart(2, '0');
  return `${civil.year}-${month}-${day}`;
}

function addCalendarDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function parseHm(value: string): number {
  const [hourRaw, minuteRaw] = value.split(':');
  return Number(hourRaw) * 60 + Number(minuteRaw);
}

function windowsFor(hours: BusinessHours, civil: Civil, holidays: readonly string[]): [string, string][] {
  if (holidays.includes(dateKey(civil))) return [];
  const key = DAY_KEYS[civil.dow] ?? 'sun';
  return hours[key] ?? [];
}

// SLA due instant - null minutes means the area has no critical threshold.
export function addBusinessMinutes(
  start: Date,
  minutes: number | null,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  holidays: readonly string[] = [],
  timeZone = 'America/Argentina/Buenos_Aires',
): Date | null {
  if (minutes == null) return null;
  if (minutes <= 0) return new Date(start.getTime());

  let remaining = minutes;
  let cursor = new Date(start.getTime());

  for (let guard = 0; guard < 500 && remaining > 0; guard += 1) {
    const civil = toCivil(cursor, timeZone);
    const windows = windowsFor(hours, civil, holidays);
    const window = windows.find((range) => civil.minutes < parseHm(range[1]));
    if (!window) {
      const next = addCalendarDays(civil.year, civil.month, civil.day, 1);
      cursor = civilToUtc(next.year, next.month, next.day, 0, timeZone);
      continue;
    }
    const openMin = parseHm(window[0]);
    const closeMin = parseHm(window[1]);
    if (civil.minutes < openMin) {
      cursor = civilToUtc(civil.year, civil.month, civil.day, openMin, timeZone);
      continue;
    }
    const available = closeMin - civil.minutes;
    if (remaining <= available) {
      return civilToUtc(civil.year, civil.month, civil.day, civil.minutes + remaining, timeZone);
    }
    remaining -= available;
    cursor = civilToUtc(civil.year, civil.month, civil.day, closeMin, timeZone);
  }

  throw new Error('business_minutes_overflow');
}

// Open now - true when the instant falls inside a business window and not a holiday.
export function isWithinBusinessHours(
  at: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  holidays: readonly string[] = [],
  timeZone = 'America/Argentina/Buenos_Aires',
): boolean {
  const civil = toCivil(at, timeZone);
  const windows = windowsFor(hours, civil, holidays);
  return windows.some((range) => {
    const openMin = parseHm(range[0]);
    const closeMin = parseHm(range[1]);
    return civil.minutes >= openMin && civil.minutes < closeMin;
  });
}

// Elapsed business minutes - closed interval start, open at end.
export function businessMinutesBetween(
  start: Date,
  end: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  holidays: readonly string[] = [],
  timeZone = 'America/Argentina/Buenos_Aires',
): number {
  if (end.getTime() <= start.getTime()) return 0;
  let total = 0;
  let cursor = new Date(start.getTime());

  for (let guard = 0; guard < 500 && cursor.getTime() < end.getTime(); guard += 1) {
    const civil = toCivil(cursor, timeZone);
    const endCivil = toCivil(end, timeZone);
    const windows = windowsFor(hours, civil, holidays);
    const window = windows.find((range) => civil.minutes < parseHm(range[1]));
    if (!window) {
      const next = addCalendarDays(civil.year, civil.month, civil.day, 1);
      cursor = civilToUtc(next.year, next.month, next.day, 0, timeZone);
      continue;
    }
    const openMin = parseHm(window[0]);
    const closeMin = parseHm(window[1]);
    if (civil.minutes < openMin) {
      cursor = civilToUtc(civil.year, civil.month, civil.day, openMin, timeZone);
      continue;
    }
    const sameDay =
      civil.year === endCivil.year && civil.month === endCivil.month && civil.day === endCivil.day;
    const cap = sameDay ? Math.min(closeMin, endCivil.minutes) : closeMin;
    if (cap <= civil.minutes) {
      const next = addCalendarDays(civil.year, civil.month, civil.day, 1);
      cursor = civilToUtc(next.year, next.month, next.day, 0, timeZone);
      continue;
    }
    total += cap - civil.minutes;
    if (sameDay && endCivil.minutes <= closeMin) return total;
    cursor = civilToUtc(civil.year, civil.month, civil.day, cap, timeZone);
  }

  return total;
}
