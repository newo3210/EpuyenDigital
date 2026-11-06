// Evolution HTTP client - connection test + text send for panel outbound / admin

export type EvolutionSendTextResult = { externalId: string };

export type EvolutionClient = {
  testConnection(params: { instance: string }): Promise<{ ok: boolean; detail?: string }>;
  sendText(params: {
    instance: string;
    phone: string;
    text: string;
  }): Promise<EvolutionSendTextResult>;
};

// HttpEvolutionClient - Evolution API v2; never logs apiKey
export class HttpEvolutionClient implements EvolutionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async testConnection(params: { instance: string }): Promise<{ ok: boolean; detail?: string }> {
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/instance/connectionState/${params.instance}`;
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { apikey: this.apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return { ok: false, detail: `HTTP_${res.status}` };
      }
      const json = (await res.json()) as { instance?: { state?: string }; state?: string };
      const state = json.instance?.state ?? json.state ?? '';
      const connected = ['open', 'connected', 'CONNECTED', 'OPEN'].includes(state);
      return connected
        ? { ok: true, detail: state || 'connected' }
        : { ok: false, detail: state || 'disconnected' };
    } catch {
      return { ok: false, detail: 'UNREACHABLE' };
    }
  }

  async sendText(params: {
    instance: string;
    phone: string;
    text: string;
  }): Promise<EvolutionSendTextResult> {
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/message/sendText/${params.instance}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      body: JSON.stringify({ number: params.phone, text: params.text }),
    });
    if (!res.ok) {
      throw new Error(`EVOLUTION_SEND_FAILED:${res.status}`);
    }
    const json = (await res.json()) as { key?: { id?: string } };
    return { externalId: json.key?.id ?? `out-${Date.now()}` };
  }
}
