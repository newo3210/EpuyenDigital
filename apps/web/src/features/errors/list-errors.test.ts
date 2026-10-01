import { errorFiltersSchema } from '@/contracts/errors';
import { toLogFilters } from './list-errors';

// Query parsing - invalid values are dropped, valid ones kept.
describe('errorFiltersSchema', () => {
  it('keeps valid filters and drops invalid ones', () => {
    const parsed = errorFiltersSchema.parse({
      status: 'resolved',
      source: 'telepathy',
      level: 'warn',
      from: '2026-09-01',
      to: '01/10/2026',
      id: 'not-a-uuid',
    });

    expect(parsed).toEqual({ status: 'resolved', level: 'warn', from: '2026-09-01' });
  });
});

// Repository filters - day bounds interpreted in Argentina time (UTC-3).
describe('toLogFilters', () => {
  it('maps date-only bounds to inclusive Argentina day ranges', () => {
    expect(toLogFilters({ from: '2026-09-01', to: '2026-09-30' })).toEqual({
      from: '2026-09-01T00:00:00.000-03:00',
      to: '2026-09-30T23:59:59.999-03:00',
    });
  });

  it('passes enum filters through and omits empty ones', () => {
    expect(toLogFilters({ status: 'open', source: 'web', level: 'error' })).toEqual({
      status: 'open',
      source: 'web',
      level: 'error',
    });
    expect(toLogFilters({})).toEqual({});
  });
});
