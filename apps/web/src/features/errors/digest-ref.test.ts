// @vitest-environment node
import { redactDetails } from '@epuyen/shared';
import { digestRef } from './digest-ref';

// Digest reference - stable, digit-free correlation key that survives redaction.
describe('digestRef', () => {
  it('is deterministic and 16 letters long', () => {
    expect(digestRef('2415366987')).toBe(digestRef('2415366987'));
    expect(digestRef('2415366987')).toMatch(/^[a-p]{16}$/);
  });

  it('differs for different digests', () => {
    expect(digestRef('2415366987')).not.toBe(digestRef('2415366988'));
  });

  it('never contains the raw digest and is left untouched by redaction', () => {
    const ref = digestRef('2945123456');

    expect(ref).not.toContain('2945123456');
    expect(redactDetails({ digestRef: ref })).toEqual({ digestRef: ref });
  });

  it('returns undefined without a digest', () => {
    expect(digestRef(undefined)).toBeUndefined();
    expect(digestRef('')).toBeUndefined();
  });
});
