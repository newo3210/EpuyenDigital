import { describe, expect, it, vi } from 'vitest';
import { sendOperatorText } from './send-text.js';

const conversation = {
  id: '00000000-0000-4000-8000-000000000020',
  orgId: '00000000-0000-4000-8000-000000000001',
  lineId: '00000000-0000-4000-8000-000000000002',
  phoneNormalized: '5492944216586',
};

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    authorUserId: '00000000-0000-4000-8000-000000000099',
    ensureOwner: async () => ({ ok: true as const }),
    loadConversation: async () => conversation,
    loadOrgSendMode: async () => ({ sendMode: 'production' as const, allowlistPhones: [] }),
    loadLineCredentials: async () => ({
      apiKey: 'k',
      baseUrl: 'http://127.0.0.1:8080',
      instance: 'inspectoria',
    }),
    persistOutbound: async () => ({ messageId: 'm1' }),
    updateOutbound: async () => undefined,
    sendViaEvolution: async () => ({ externalId: 'wamid.out' }),
    ...overrides,
  };
}

describe('sendOperatorText', () => {
  it('rejects empty body without calling Evolution', async () => {
    const sendViaEvolution = vi.fn();
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: '   ' },
      baseDeps({ sendViaEvolution }),
    );
    expect(result.status).toBe('invalid');
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });

  it('dry_run persists simulated without Evolution', async () => {
    const sendViaEvolution = vi.fn();
    const persistOutbound = vi.fn(async () => ({ messageId: 'm-dry' }));
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola' },
      baseDeps({
        loadOrgSendMode: async () => ({ sendMode: 'dry_run', allowlistPhones: [] }),
        persistOutbound,
        sendViaEvolution,
      }),
    );
    expect(result).toMatchObject({
      status: 'ok',
      dryRun: true,
      deliveryStatus: 'simulated',
    });
    expect(sendViaEvolution).not.toHaveBeenCalled();
    expect(persistOutbound).toHaveBeenCalled();
  });

  it('allowlist blocks unknown phones', async () => {
    const sendViaEvolution = vi.fn();
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola' },
      baseDeps({
        loadConversation: async () => ({
          ...conversation,
          phoneNormalized: '5491111111111',
        }),
        loadOrgSendMode: async () => ({
          sendMode: 'allowlist',
          allowlistPhones: ['5492944216586'],
        }),
        persistOutbound: async () => ({ messageId: 'm-block' }),
        sendViaEvolution,
      }),
    );
    expect(result).toMatchObject({ status: 'ok', deliveryStatus: 'blocked', dryRun: false });
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });

  it('production persists pending before Evolution then updates to sent', async () => {
    const order: string[] = [];
    const persistOutbound = vi.fn(async () => {
      order.push('persist');
      return { messageId: 'm-prod' };
    });
    const sendViaEvolution = vi.fn(async () => {
      order.push('evolution');
      return { externalId: 'wamid.out' };
    });
    const updateOutbound = vi.fn(async () => {
      order.push('update');
    });

    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola producción' },
      baseDeps({ persistOutbound, sendViaEvolution, updateOutbound }),
    );

    expect(result.status).toBe('ok');
    expect(order).toEqual(['persist', 'evolution', 'update']);
    expect(persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'pending' }),
    );
    expect(updateOutbound).toHaveBeenCalledWith({
      messageId: 'm-prod',
      deliveryStatus: 'sent',
      externalId: 'wamid.out',
    });
    expect(sendViaEvolution).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '5492944216586', text: 'hola producción' }),
    );
  });

  it('claims via ensureOwner before persisting an unowned thread', async () => {
    const order: string[] = [];
    const ensureOwner = vi.fn(async () => {
      order.push('ensure');
      return { ok: true as const };
    });
    const persistOutbound = vi.fn(async () => {
      order.push('persist');
      return { messageId: 'm-claim' };
    });
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'tomo y respondo' },
      baseDeps({ ensureOwner, persistOutbound }),
    );
    expect(result.status).toBe('ok');
    expect(order[0]).toBe('ensure');
    expect(persistOutbound).toHaveBeenCalled();
  });

  it('does not persist or call Evolution when another operator owns the thread', async () => {
    const persistOutbound = vi.fn();
    const sendViaEvolution = vi.fn();
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola' },
      baseDeps({
        ensureOwner: async () => ({ ok: false, message: 'La tiene Ana' }),
        persistOutbound,
        sendViaEvolution,
      }),
    );
    expect(result).toMatchObject({ status: 'failed', message: 'La tiene Ana' });
    expect(persistOutbound).not.toHaveBeenCalled();
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });

  it('marks pending row failed when Evolution throws (row already persisted)', async () => {
    const persistOutbound = vi.fn(async () => ({ messageId: 'm-fail' }));
    const updateOutbound = vi.fn(async () => undefined);
    const sendViaEvolution = vi.fn(async () => {
      throw new Error('evolution down');
    });

    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola' },
      baseDeps({ persistOutbound, updateOutbound, sendViaEvolution }),
    );

    expect(result.status).toBe('failed');
    expect(persistOutbound).toHaveBeenCalled();
    expect(updateOutbound).toHaveBeenCalledWith({
      messageId: 'm-fail',
      deliveryStatus: 'failed',
    });
  });
});
