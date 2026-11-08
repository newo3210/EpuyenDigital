import { describe, expect, it } from 'vitest';
import { delegateInputSchema, rejectNoteSchema } from './inbox';

describe('inbox contracts', () => {
  it('requires a note and exactly one delegate target', () => {
    const both = delegateInputSchema.safeParse({
      conversationId: '00000000-0000-4000-8000-0000000000f1',
      targetUserId: '00000000-0000-4000-8000-0000000000a2',
      targetAreaId: '00000000-0000-4000-8000-0000000000d2',
      note: 'pasar',
    });
    expect(both.success).toBe(false);

    const none = delegateInputSchema.safeParse({
      conversationId: '00000000-0000-4000-8000-0000000000f1',
      note: '   ',
    });
    expect(none.success).toBe(false);
  });

  it('rejects an empty rejection note', () => {
    expect(
      rejectNoteSchema.safeParse({
        conversationId: '00000000-0000-4000-8000-0000000000f1',
        note: '  ',
      }).success,
    ).toBe(false);
  });
});
