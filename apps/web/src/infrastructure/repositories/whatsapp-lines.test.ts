import { describe, expect, it, vi } from 'vitest';
import { RepositoryError } from './errors.js';
import {
  listWhatsappLines,
  loadDecryptedLineCredentials,
} from './whatsapp-lines.js';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000099';
const LINE_A = '00000000-0000-4000-8000-000000000002';

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = vi.fn(self);
  api.eq = vi.fn(self);
  api.order = vi.fn(self);
  api.maybeSingle = vi.fn(async () => result);
  api.single = vi.fn(async () => result);
  return api;
}

describe('listWhatsappLines secretFlags under REVOKE', () => {
  it('loads presence flags via secrets client; never selects secrets with user JWT client', async () => {
    const userFrom = vi.fn((table: string) => {
      if (table === 'whatsapp_line_secrets') {
        throw new Error('authenticated must not SELECT whatsapp_line_secrets after REVOKE');
      }
      expect(table).toBe('whatsapp_lines');
      return {
        select: () => ({
          order: async () => ({
            data: [
              {
                id: LINE_A,
                org_id: ORG_A,
                name: 'Inspectoría',
                display_phone: '+5492944216586',
                evolution_base_url: 'http://127.0.0.1:8080',
                evolution_instance: 'inspectoria',
                default_area_id: null,
                status: 'disconnected',
                last_status_at: null,
              },
            ],
            error: null,
          }),
        }),
      };
    });

    const secretsFrom = vi.fn((table: string) => {
      expect(table).toBe('whatsapp_line_secrets');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                api_key_ciphertext: 'v1:x:y:z',
                webhook_secret_ciphertext: 'v1:a:b:c',
                webhook_secret: null,
              },
              error: null,
            }),
          }),
        }),
      };
    });

    const lines = await listWhatsappLines(
      { from: userFrom } as never,
      { from: secretsFrom } as never,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      hasApiKey: true,
      hasWebhookSecret: true,
    });
    expect(userFrom).toHaveBeenCalledWith('whatsapp_lines');
    expect(userFrom).not.toHaveBeenCalledWith('whatsapp_line_secrets');
    expect(secretsFrom).toHaveBeenCalledWith('whatsapp_line_secrets');
  });
});

describe('loadDecryptedLineCredentials org binding', () => {
  it('denies decrypt when lineId belongs to another org', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'whatsapp_lines') {
        return chain({ data: null, error: null });
      }
      throw new Error(`unexpected table ${table} before org check`);
    });

    await expect(
      loadDecryptedLineCredentials({ from } as never, LINE_A, ORG_B),
    ).rejects.toMatchObject({
      code: 'lines.forbidden_or_missing',
    } satisfies Partial<RepositoryError>);

    expect(from).toHaveBeenCalledWith('whatsapp_lines');
    expect(from).not.toHaveBeenCalledWith('whatsapp_line_secrets');
  });
});
