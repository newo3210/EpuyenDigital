import { describe, expect, it } from 'vitest';
import { addBusinessMinutes, businessMinutesBetween, computeSlaStatus } from './sla';

const TZ = 'America/Argentina/Buenos_Aires';
const WEEKDAY_HOURS = {
  mon: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
  tue: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
  wed: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
  thu: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
  fri: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
};

describe('SLA helpers', () => {
  it('falls back to calendar minutes when business hours are empty', () => {
    const from = new Date('2026-11-07T10:00:00.000Z');
    const to = new Date('2026-11-07T10:45:00.000Z');
    expect(businessMinutesBetween({ from, to, businessHours: {} })).toBe(45);
  });

  it('marks critical after elapsed business minutes', () => {
    const status = computeSlaStatus({
      enteredQueueAt: new Date(Date.now() - 40 * 60_000),
      area: { warningMinutes: 15, criticalMinutes: 30 },
      businessHours: {},
    });
    expect(status).toBe('critical');
  });

  it('stays ok under warning threshold', () => {
    const status = computeSlaStatus({
      enteredQueueAt: new Date(Date.now() - 5 * 60_000),
      area: { warningMinutes: 15, criticalMinutes: 30 },
      businessHours: {},
    });
    expect(status).toBe('ok');
  });

  it('does not count the lunch gap as business minutes', () => {
    // Friday 2026-11-06 11:30–13:30 ART = 14:30–16:30 UTC (ART = UTC-3)
    const from = new Date('2026-11-06T14:30:00.000Z');
    const to = new Date('2026-11-06T16:30:00.000Z');
    // 11:30–12:00 (30) + 13:00–13:30 (30) = 60; calendar would be 120
    expect(
      businessMinutesBetween({
        from,
        to,
        businessHours: WEEKDAY_HOURS,
        timeZone: TZ,
      }),
    ).toBe(60);
  });

  it('skips holidays when counting elapsed business minutes', () => {
    // Monday holiday: 2026-11-09 is a Monday
    const from = new Date('2026-11-09T12:00:00.000Z'); // 09:00 ART
    const to = new Date('2026-11-09T15:00:00.000Z'); // 12:00 ART
    expect(
      businessMinutesBetween({
        from,
        to,
        businessHours: WEEKDAY_HOURS,
        holidays: ['2026-11-09'],
        timeZone: TZ,
      }),
    ).toBe(0);
  });

  it('counts overnight span only through next open window', () => {
    // Fri 16:30 ART → Mon 10:00 ART across weekend
    const from = new Date('2026-11-06T19:30:00.000Z'); // Fri 16:30 ART
    const to = new Date('2026-11-09T13:00:00.000Z'); // Mon 10:00 ART
    // Fri 16:30–17:00 = 30; Mon 09:00–10:00 = 60 → 90
    expect(
      businessMinutesBetween({
        from,
        to,
        businessHours: WEEKDAY_HOURS,
        timeZone: TZ,
      }),
    ).toBe(90);
  });

  it('addBusinessMinutes skips lunch when computing sla due', () => {
    const from = new Date('2026-11-06T14:00:00.000Z'); // Fri 11:00 ART
    // Need 90 business minutes: 11:00–12:00 (60) + 13:00–13:30 (30) → due 13:30 ART = 16:30Z
    const due = addBusinessMinutes({
      from,
      minutes: 90,
      businessHours: WEEKDAY_HOURS,
      timeZone: TZ,
    });
    expect(
      businessMinutesBetween({
        from,
        to: due,
        businessHours: WEEKDAY_HOURS,
        timeZone: TZ,
      }),
    ).toBe(90);
    // Due should land after lunch, not at calendar +90m (12:30 ART / 15:30Z)
    expect(due.getTime()).toBeGreaterThan(new Date('2026-11-06T15:30:00.000Z').getTime());
  });

  it('addBusinessMinutes calendar-falls-back when hours empty', () => {
    const from = new Date('2026-11-07T10:00:00.000Z');
    const due = addBusinessMinutes({ from, minutes: 30, businessHours: {} });
    expect(due.toISOString()).toBe('2026-11-07T10:30:00.000Z');
  });

  it('warning across lunch uses business elapsed not calendar', () => {
    const entered = new Date('2026-11-06T14:30:00.000Z'); // 11:30 ART
    const now = new Date('2026-11-06T16:00:00.000Z'); // 13:00 ART
    // Business elapsed = 30 (11:30–12:00); calendar = 90
    const status = computeSlaStatus({
      enteredQueueAt: entered,
      now,
      area: { warningMinutes: 45, criticalMinutes: 90 },
      businessHours: WEEKDAY_HOURS,
      timeZone: TZ,
    });
    expect(status).toBe('ok');
  });
});
