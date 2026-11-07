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
    loadConversation: async () => conversation,
    ensureOwner: async () => ({ status: 'ok' as const }),
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

  it('blocks send on CLAIM_CONFLICT before persist', async () => {
    const persistOutbound = vi.fn();
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola' },
      baseDeps({
        ensureOwner: async () => ({
          status: 'error',
          error: { code: 'CLAIM_CONFLICT', message: 'owned' },
          ownerName: 'Ana Pérez',
        }),
        persistOutbound,
      }),
    );
    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') {
      expect(result.message).toContain('Ana Pérez');
    }
    expect(persistOutbound).not.toHaveBeenCalled();
  });

  it('claims via ensureOwner then dry_run persists simulated', async () => {
    const ensureOwner = vi.fn(async () => ({ status: 'ok' as const }));
    const sendViaEvolution = vi.fn();
    const persistOutbound = vi.fn(async () => ({ messageId: 'm-dry' }));
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola' },
      baseDeps({
        ensureOwner,
        loadOrgSendMode: async () => ({ sendMode: 'dry_run', allowlistPhones: [] }),
        persistOutbound,
        sendViaEvolution,
      }),
    );
    expect(ensureOwner).toHaveBeenCalledWith(conversation.id);
    expect(result).toMatchObject({
      status: 'ok',
      dryRun: true,
      deliveryStatus: 'simulated',
    });
    expect(sendViaEvolution).not.toHaveBeenCalled();
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
  });

  it('marks pending row failed when Evolution throws', async () => {
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
    expect(updateOutbound).toHaveBeenCalledWith({
      messageId: 'm-fail',
      deliveryStatus: 'failed',
    });
  });
});
