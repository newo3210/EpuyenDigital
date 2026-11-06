import { esAR } from '@/i18n/es-AR';

const messages = esAR.lines.errors;

export type TestConnectionDeps = {
  loadCredentials: (lineId: string) => Promise<{
    apiKey: string | null;
    baseUrl: string | null;
    instance: string;
  }>;
  testConnection: (params: {
    baseUrl: string;
    apiKey: string;
    instance: string;
  }) => Promise<{ ok: boolean; detail?: string }>;
  updateStatus: (lineId: string, status: 'connected' | 'disconnected' | 'error') => Promise<void>;
};

export type TestConnectionResult =
  | { status: 'ok'; connected: true; detail?: string }
  | { status: 'ok'; connected: false; detail?: string }
  | { status: 'failed'; message: string };

// Test-connection use case - probes Evolution; updates line status; never echoes secrets.
export async function testLineConnection(
  lineId: string,
  deps: TestConnectionDeps,
): Promise<TestConnectionResult> {
  if (!lineId) return { status: 'failed', message: messages.idRequired };

  try {
    const creds = await deps.loadCredentials(lineId);
    if (!creds.baseUrl || !creds.apiKey) {
      await deps.updateStatus(lineId, 'error');
      return { status: 'failed', message: messages.missingCredentials };
    }
    const result = await deps.testConnection({
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      instance: creds.instance,
    });
    if (result.ok) {
      await deps.updateStatus(lineId, 'connected');
      return { status: 'ok', connected: true, detail: result.detail };
    }
    await deps.updateStatus(lineId, 'disconnected');
    return { status: 'ok', connected: false, detail: result.detail };
  } catch {
    try {
      await deps.updateStatus(lineId, 'error');
    } catch {
      // status update best-effort
    }
    return { status: 'failed', message: messages.connectionFailed };
  }
}
