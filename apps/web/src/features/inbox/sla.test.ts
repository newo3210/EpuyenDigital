import { describe, expect, it } from 'vitest';
import { businessMinutesBetween, computeSlaStatus } from './sla';

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
});
