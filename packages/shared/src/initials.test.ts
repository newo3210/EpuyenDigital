import { describe, expect, it } from 'vitest';
import { FALLBACK_INITIALS, initials } from './initials';

// Initials - avatar fallback derived from the operator display name.
describe('initials', () => {
  it('returns first and last initials for "Ana Pérez"', () => {
    expect(initials('Ana Pérez')).toBe('AP');
  });

  it('uses first and last word when there are middle names', () => {
    expect(initials('Ana María Pérez Gómez')).toBe('AG');
  });

  it('returns a single initial for a single name', () => {
    expect(initials('Ana')).toBe('A');
  });

  it('ignores leading, trailing and repeated spaces', () => {
    expect(initials('   ana    pérez  ')).toBe('AP');
  });

  it('uppercases accented and ñ initials', () => {
    expect(initials('ángel ñancucheo')).toBe('ÁÑ');
  });

  it('returns the fallback for an empty or blank name', () => {
    expect(initials('')).toBe(FALLBACK_INITIALS);
    expect(initials('    ')).toBe(FALLBACK_INITIALS);
  });
});
