import { describe, expect, it } from 'vitest';
import { addBusinessMinutes, businessMinutesBetween, DEFAULT_BUSINESS_HOURS } from './business-minutes.js';

const tz = 'America/Argentina/Buenos_Aires';

function art(isoLocal: string): Date {
  const withOffset = isoLocal.includes('T') ? `${isoLocal}-03:00` : `${isoLocal}T00:00:00-03:00`;
  return new Date(withOffset);
}

describe('addBusinessMinutes', () => {
  it('adds 120 minutes inside Monday morning to 10:00', () => {
    const due = addBusinessMinutes(art('2026-11-09T08:00:00'), 120, DEFAULT_BUSINESS_HOURS, [], tz);
    expect(due?.toISOString()).toBe(art('2026-11-09T10:00:00').toISOString());
  });

  it('skips the weekend: Friday 13:00 plus 120 business minutes is Monday 09:00', () => {
    const due = addBusinessMinutes(art('2026-11-06T13:00:00'), 120, DEFAULT_BUSINESS_HOURS, [], tz);
    expect(due?.toISOString()).toBe(art('2026-11-09T09:00:00').toISOString());
  });

  it('skips a holiday like a closed day', () => {
    const due = addBusinessMinutes(
      art('2026-11-06T13:00:00'),
      120,
      DEFAULT_BUSINESS_HOURS,
      ['2026-11-09'],
      tz,
    );
    expect(due?.toISOString()).toBe(art('2026-11-10T09:00:00').toISOString());
  });

  it('returns null when the area has no critical minutes', () => {
    expect(addBusinessMinutes(art('2026-11-09T08:00:00'), null)).toBeNull();
  });
});

describe('businessMinutesBetween', () => {
  it('does not count Saturday toward a Friday afternoon wait', () => {
    const elapsed = businessMinutesBetween(
      art('2026-11-06T13:30:00'),
      art('2026-11-07T12:00:00'),
      DEFAULT_BUSINESS_HOURS,
      [],
      tz,
    );
    expect(elapsed).toBe(30);
  });
});
