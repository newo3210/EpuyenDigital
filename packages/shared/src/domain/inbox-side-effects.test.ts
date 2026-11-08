import { describe, expect, it } from 'vitest';
import { shouldReopenConversation } from './inbox-side-effects.js';

describe('shouldReopenConversation', () => {
  it('reopens a resolved thread on a citizen message', () => {
    expect(shouldReopenConversation({ fromMe: false, queueColumn: 'resolved' })).toBe(true);
  });

  it('does not reopen an open thread or a fromMe echo', () => {
    expect(shouldReopenConversation({ fromMe: false, queueColumn: 'new' })).toBe(false);
    expect(shouldReopenConversation({ fromMe: true, queueColumn: 'resolved' })).toBe(false);
  });
});