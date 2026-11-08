import { describe, expect, it } from 'vitest';
import { protectManualFields } from './citizen-fields';

describe('protectManualFields', () => {
  it('keeps a manual name when a later writer sends another name', () => {
    const next = protectManualFields(
      { full_name: 'Ana', document_id: null },
      { full_name: 'Bot', document_id: '30111222' },
      { full_name: 'manual' },
    );
    expect(next.full_name).toBe('Ana');
    expect(next.document_id).toBe('30111222');
  });
});
