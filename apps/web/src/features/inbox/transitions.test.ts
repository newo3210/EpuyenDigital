import { describe, expect, it, vi } from 'vitest';
import {
  claimConversation,
  ensureOwnerForReply,
  markConversationRead,
} from './transitions';

describe('inbox transitions', () => {
  it('maps successful claim RPC row', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: [
          {
            conversation_id: '00000000-0000-4000-8000-000000000020',
            owner_user_id: '00000000-0000-4000-8000-000000000099',
            queue_column: 'claimed',
            bot_state: 'paused',
            event_id: '00000000-0000-4000-8000-000000000030',
          },
        ],
        error: null,
      })),
    };
    const result = await claimConversation(client, '00000000-0000-4000-8000-000000000020');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.queueColumn).toBe('claimed');
      expect(result.data.botState).toBe('paused');
    }
  });

  it('surfaces CLAIM_CONFLICT from ensure_owner', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          message: 'CLAIM_CONFLICT',
          details: 'owned_by:00000000-0000-4000-8000-000000000088',
        },
      })),
    };
    const result = await ensureOwnerForReply(client, '00000000-0000-4000-8000-000000000020');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('CLAIM_CONFLICT');
      expect(result.error.ownerUserId).toBe('00000000-0000-4000-8000-000000000088');
    }
  });

  it('treats void mark_conversation_read as ok', async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: null })),
    };
    const result = await markConversationRead(client, '00000000-0000-4000-8000-000000000020');
    expect(result).toEqual({ status: 'ok', data: { ok: true } });
  });
});
