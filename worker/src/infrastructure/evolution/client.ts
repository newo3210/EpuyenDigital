import { readFile } from "node:fs/promises";
import path from "node:path";

// Evolution client - outbound text/buttons/image and media download adapters

export type EvolutionClient = {
  sendText(params: {
    instance: string;
    phone: string;
    text: string;
    buttons?: { id: string; label: string }[];
  }): Promise<{ externalId: string }>;
  sendImage(params: {
    instance: string;
    phone: string;
    mediaPath: string;
    caption?: string;
  }): Promise<{ externalId: string }>;
  downloadMedia(url: string): Promise<{ bytes: Uint8Array; mime: string }>;
};

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

// HttpEvolutionClient - Evolution API v2 HTTP adapter
export class HttpEvolutionClient implements EvolutionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async sendText(params: {
    instance: string;
    phone: string;
    text: string;
    buttons?: { id: string; label: string }[];
  }): Promise<{ externalId: string }> {
    const endpoint = params.buttons?.length
      ? `${this.baseUrl}/message/sendButtons/${params.instance}`
      : `${this.baseUrl}/message/sendText/${params.instance}`;

    const body = params.buttons?.length
      ? {
          number: params.phone,
          title: "Inspectoría",
          description: params.text,
          buttons: params.buttons.map((b) => ({
            type: "reply",
            displayText: b.label,
            id: b.id,
          })),
        }
      : { number: params.phone, text: params.text };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`EVOLUTION_SEND_FAILED:${res.status}`);
    }
    const json = (await res.json()) as { key?: { id?: string } };
    return { externalId: json.key?.id ?? `out-${Date.now()}` };
  }

  // sendImage - Evolution sendMedia with local file as base64
  async sendImage(params: {
    instance: string;
    phone: string;
    mediaPath: string;
    caption?: string;
  }): Promise<{ externalId: string }> {
    const bytes = await readFile(params.mediaPath);
    const mime = guessMime(params.mediaPath);
    const endpoint = `${this.baseUrl}/message/sendMedia/${params.instance}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: JSON.stringify({
        number: params.phone,
        mediatype: "image",
        mimetype: mime,
        caption: params.caption ?? "",
        media: Buffer.from(bytes).toString("base64"),
        fileName: path.basename(params.mediaPath),
      }),
    });
    if (!res.ok) {
      throw new Error(`EVOLUTION_SEND_MEDIA_FAILED:${res.status}`);
    }
    const json = (await res.json()) as { key?: { id?: string } };
    return { externalId: json.key?.id ?? `out-img-${Date.now()}` };
  }

  async downloadMedia(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
    const res = await fetch(url, {
      headers: { apikey: this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`EVOLUTION_MEDIA_FAILED:${res.status}`);
    }
    const mime = res.headers.get("content-type") ?? "application/octet-stream";
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf, mime };
  }
}

// MemoryEvolutionClient - fake for unit tests
export class MemoryEvolutionClient implements EvolutionClient {
  sent: Array<{
    phone: string;
    text: string;
    buttons?: { id: string; label: string }[];
    mediaPath?: string;
  }> = [];
  media = new Map<string, { bytes: Uint8Array; mime: string }>();

  async sendText(params: {
    instance: string;
    phone: string;
    text: string;
    buttons?: { id: string; label: string }[];
  }): Promise<{ externalId: string }> {
    this.sent.push({ phone: params.phone, text: params.text, buttons: params.buttons });
    return { externalId: `mem-${this.sent.length}` };
  }

  async sendImage(params: {
    instance: string;
    phone: string;
    mediaPath: string;
    caption?: string;
  }): Promise<{ externalId: string }> {
    this.sent.push({
      phone: params.phone,
      text: params.caption ?? "",
      mediaPath: params.mediaPath,
    });
    return { externalId: `mem-img-${this.sent.length}` };
  }

  async downloadMedia(url: string): Promise<{ bytes: Uint8Array; mime: string }> {
    const hit = this.media.get(url);
    if (!hit) throw new Error("EVOLUTION_MEDIA_FAILED:404");
    return hit;
  }
}
