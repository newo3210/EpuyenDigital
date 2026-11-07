import { describe, expect, it } from 'vitest';
import { resolveInquiryCoords } from './inquiry-coords';

describe('resolveInquiryCoords', () => {
  it('prefers conversation denorm over message pins', () => {
    const resolved = resolveInquiryCoords(
      { inquiryLatitude: -42.1, inquiryLongitude: -71.2 },
      [{ kind: 'location', latitude: -40, longitude: -70 }],
    );
    expect(resolved).toEqual({
      latitude: -42.1,
      longitude: -71.2,
      source: 'conversation',
    });
  });

  it('falls back to latest location message', () => {
    const resolved = resolveInquiryCoords({}, [
      { kind: 'text', latitude: null, longitude: null },
      { kind: 'location', latitude: -42.229, longitude: -71.358 },
    ]);
    expect(resolved?.source).toBe('message');
    expect(resolved?.latitude).toBe(-42.229);
  });

  it('returns null when no coords exist', () => {
    expect(resolveInquiryCoords({}, [{ kind: 'text' }])).toBeNull();
  });
});
