import { describe, expect, it } from 'vitest';
import { mapRpcError } from './ownership-errors';

describe('mapRpcError', () => {
  it('maps CLAIM_CONFLICT with owner uuid', () => {
    const mapped = mapRpcError({
      message: 'CLAIM_CONFLICT',
      details: 'owned_by:00000000-0000-4000-8000-000000000099',
    });
    expect(mapped).toEqual({
      code: 'CLAIM_CONFLICT',
      message: expect.stringContaining('CLAIM_CONFLICT'),
      ownerUserId: '00000000-0000-4000-8000-000000000099',
    });
  });

  it('maps note required as invalid argument', () => {
    expect(mapRpcError({ message: 'invalid_argument', details: 'NOTE_REQUIRED' }).code).toBe(
      'INVALID_ARGUMENT',
    );
  });
});
