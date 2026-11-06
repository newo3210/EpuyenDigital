import { describe, expect, it, vi } from 'vitest';
import { sendOperatorText } from './send-text.js';

const conversation = {
  id: '00000000-0000-4000-8000-000000000020',
  orgId: '00000000-0000-4000-8000-000000000001',
  lineId: '00000000-0000-4000-8000-000000000002',
  phoneNormalized: '5492944216586',
};

describe('sendOperatorText', () => {
  it('rejects empty body without calling Evolution', async () => {
    const sendViaEvolution = vi.fn();
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: '   ' },
      {
        authorUserId: '00000000-0000-4000-8000-000000000099',
        loadConversation: async () => conversation,
        loadOrgSendMode: async () => ({ sendMode: 'production', allowlistPhones: [] }),
        loadLineCredentials: async () => ({
          apiKey: 'k',
          baseUrl: 'http://127.0.0.1:8080',
          instance: 'inspectoria',
        }),
        persistOutbound: async () => ({ messageId: 'm1' }),
        sendViaEvolution,
      },
    );
    expect(result.status).toBe('invalid');
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });

  it('dry_run persists simulated without Evolution', async () => {
    const sendViaEvolution = vi.fn();
    const persistOutbound = vi.fn(async () => ({ messageId: 'm-dry' }));
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola' },
      {
        authorUserId: '00000000-0000-4000-8000-000000000099',
        loadConversation: async () => conversation,
        loadOrgSendMode: async () => ({ sendMode: 'dry_run', allowlistPhones: [] }),
        loadLineCredentials: async () => ({
          apiKey: 'k',
          baseUrl: 'http://127.0.0.1:8080',
          instance: 'inspectoria',
        }),
        persistOutbound,
        sendViaEvolution,
      },
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
      {
        authorUserId: '00000000-0000-4000-8000-000000000099',
        loadConversation: async () => ({
          ...conversation,
          phoneNormalized: '5491111111111',
        }),
        loadOrgSendMode: async () => ({
          sendMode: 'allowlist',
          allowlistPhones: ['5492944216586'],
        }),
        loadLineCredentials: async () => ({
          apiKey: 'k',
          baseUrl: 'http://127.0.0.1:8080',
          instance: 'inspectoria',
        }),
        persistOutbound: async () => ({ messageId: 'm-block' }),
        sendViaEvolution,
      },
    );
    expect(result).toMatchObject({ status: 'ok', deliveryStatus: 'blocked', dryRun: false });
    expect(sendViaEvolution).not.toHaveBeenCalled();
  });

  it('production calls Evolution with normalized phone', async () => {
    const sendViaEvolution = vi.fn(async () => ({ externalId: 'wamid.out' }));
    const result = await sendOperatorText(
      { conversationId: conversation.id, text: 'hola producción' },
      {
        authorUserId: '00000000-0000-4000-8000-000000000099',
        loadConversation: async () => conversation,
        loadOrgSendMode: async () => ({ sendMode: 'production', allowlistPhones: [] }),
        loadLineCredentials: async () => ({
          apiKey: 'k',
          baseUrl: 'http://127.0.0.1:8080',
          instance: 'inspectoria',
        }),
        persistOutbound: async () => ({ messageId: 'm-prod' }),
        sendViaEvolution,
      },
    );
    expect(result.status).toBe('ok');
    expect(sendViaEvolution).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '5492944216586', text: 'hola producción' }),
    );
  });
});
