import { describe, expect, it } from 'vitest';
import { SHORT_CODE_LENGTH, TRACE_HEADER, generateTraceId, resolveTraceId, shortCode } from './trace';

// UUID v4 shape - format produced by crypto.randomUUID.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Trace id generation - unique UUID v4 per request.
describe('generateTraceId', () => {
  it('returns a UUID v4', () => {
    expect(generateTraceId()).toMatch(UUID_V4_RE);
  });

  it('returns a different id on each call', () => {
    expect(generateTraceId()).not.toBe(generateTraceId());
  });
});

// Short incident code - first 8 characters shown to the user.
describe('shortCode', () => {
  it('returns the first 8 characters uppercased', () => {
    expect(shortCode('550e8400-e29b-41d4-a716-446655440000')).toBe('550E8400');
    expect(SHORT_CODE_LENGTH).toBe(8);
  });

  it('works for any trace id of at least 8 characters', () => {
    expect(shortCode('abcdefghijkl')).toBe('ABCDEFGH');
  });
});

// Incoming header resolution - reuse safe ids, otherwise generate a new one.
describe('resolveTraceId', () => {
  it('exposes the header name', () => {
    expect(TRACE_HEADER).toBe('x-trace-id');
  });

  it('reuses a valid incoming id', () => {
    expect(resolveTraceId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('trims surrounding whitespace from a valid id', () => {
    expect(resolveTraceId('  abcdef12  ')).toBe('abcdef12');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['too short', 'abc'],
    ['too long', 'a'.repeat(65)],
    ['unsafe characters', 'abc<script>alert(1)</script>'],
    ['header injection', 'abcdefgh\r\nset-cookie: x'],
  ])('generates a new id when the incoming value is %s', (_label, incoming) => {
    expect(resolveTraceId(incoming)).toMatch(UUID_V4_RE);
  });
});
