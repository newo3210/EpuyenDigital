import { visionTraitsSchema, type VisionTraits } from "@epuyen/shared";

// Vision client - provider-agnostic animal photo analysis

export type VisionClient = {
  analyzeAnimalPhotos(images: { mime: string; base64: string }[]): Promise<VisionTraits>;
};

export type VisionHttpConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

// OpenAiCompatibleVisionClient - Chat Completions with image inputs + Zod parse
export class OpenAiCompatibleVisionClient implements VisionClient {
  constructor(private readonly config: VisionHttpConfig) {}

  async analyzeAnimalPhotos(
    images: { mime: string; base64: string }[],
  ): Promise<VisionTraits> {
    return this.callWithRetry(images, true);
  }

  private async callWithRetry(
    images: { mime: string; base64: string }[],
    allowRetry: boolean,
  ): Promise<VisionTraits> {
    try {
      const content = [
        {
          type: "text",
          text: 'Describe distinctive traits of the pet in the photos. Reply ONLY with JSON: {"summary":string,"colors":string[],"markings":string[],"notableFeatures":string[]}',
        },
        ...images.map((img) => ({
          type: "image_url",
          image_url: {
            url: `data:${img.mime};base64,${img.base64}`,
          },
        })),
      ];

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`VISION_HTTP_${res.status}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content ?? "";
      const parsedJson = JSON.parse(raw) as unknown;
      return visionTraitsSchema.parse(parsedJson);
    } catch (err) {
      if (allowRetry) {
        return this.callWithRetry(images, false);
      }
      throw err;
    }
  }
}

// MemoryVisionClient - fixture-driven fake
export class MemoryVisionClient implements VisionClient {
  constructor(
    private readonly impl: (
      images: { mime: string; base64: string }[],
    ) => Promise<unknown> | unknown,
  ) {}

  async analyzeAnimalPhotos(
    images: { mime: string; base64: string }[],
  ): Promise<VisionTraits> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.impl(images);
        return visionTraitsSchema.parse(raw);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }
}
