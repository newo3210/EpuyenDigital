import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GROUP_PAYLOAD = {
  instance: 'inspectoria',
  data: {
    key: { id: 'g1', remoteJid: '120363@g.us' },
    message: { conversation: 'hola grupo' },
  },
};

describe('evolution webhook auth before ignore', () => {
  const previousWebhook = process.env.WEBHOOK_SECRET;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (previousWebhook === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = previousWebhook;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });

  it('rejects group payload without secret (401) instead of ignored:true', async () => {
    process.env.WEBHOOK_SECRET = 'dev-secret';
    const { POST } = await import('./route.js');
    const response = await POST(
      new Request('http://localhost/api/webhooks/evolution', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(GROUP_PAYLOAD),
      }),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
  });

  it('rejects group payload when line secret unset (503) instead of ignored:true', async () => {
    delete process.env.WEBHOOK_SECRET;
    const { POST } = await import('./route.js');
    const response = await POST(
      new Request('http://localhost/api/webhooks/evolution', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(GROUP_PAYLOAD),
      }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false, code: 'SECRET_NOT_CONFIGURED' });
  });

  it('returns ignored:true for group only after valid secret', async () => {
    process.env.WEBHOOK_SECRET = 'dev-secret';
    const { POST } = await import('./route.js');
    const response = await POST(
      new Request('http://localhost/api/webhooks/evolution', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': 'dev-secret',
        },
        body: JSON.stringify(GROUP_PAYLOAD),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, ignored: true, reason: 'group' });
  });
});
