import { lineUpdateSchema, type LineUpdateInput, type WhatsappLine } from '@/contracts/whatsapp-lines';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.lines.errors;

export type UpdateLineDeps = {
  updateLine: (
    lineId: string,
    input: {
      name: string;
      display_phone: string;
      evolution_base_url: string;
      evolution_instance: string;
      default_area_id: string | null;
    },
  ) => Promise<void>;
  upsertSecrets: (lineId: string, secrets: { apiKey?: string; webhookSecret?: string }) => Promise<void>;
  loadLine: (lineId: string) => Promise<WhatsappLine | null>;
};

export type UpdateLineResult =
  | { status: 'ok'; line: WhatsappLine }
  | { status: 'invalid'; fieldErrors: Partial<Record<keyof LineUpdateInput, string>> }
  | { status: 'failed'; message: string };

// Update-line use case - optional secret rotation when fields are non-empty.
export async function updateLine(input: unknown, deps: UpdateLineDeps): Promise<UpdateLineResult> {
  const parsed = lineUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: 'invalid',
      fieldErrors: {
        id: flat.id?.[0],
        name: flat.name?.[0],
        displayPhone: flat.displayPhone?.[0],
        evolutionBaseUrl: flat.evolutionBaseUrl?.[0],
        evolutionInstance: flat.evolutionInstance?.[0],
        defaultAreaId: flat.defaultAreaId?.[0],
      },
    };
  }

  try {
    await deps.updateLine(parsed.data.id, {
      name: parsed.data.name,
      display_phone: parsed.data.displayPhone,
      evolution_base_url: parsed.data.evolutionBaseUrl,
      evolution_instance: parsed.data.evolutionInstance,
      default_area_id: parsed.data.defaultAreaId ?? null,
    });
    const secretPatch: { apiKey?: string; webhookSecret?: string } = {};
    if (parsed.data.apiKey?.trim()) secretPatch.apiKey = parsed.data.apiKey.trim();
    if (parsed.data.webhookSecret?.trim()) secretPatch.webhookSecret = parsed.data.webhookSecret.trim();
    if (secretPatch.apiKey || secretPatch.webhookSecret) {
      await deps.upsertSecrets(parsed.data.id, secretPatch);
    }
    const line = await deps.loadLine(parsed.data.id);
    if (!line) return { status: 'failed', message: messages.saveFailed };
    return { status: 'ok', line };
  } catch (error) {
    const text = error instanceof Error ? error.message : '';
    if (text.includes('evolution_instance') || text.includes('duplicate key')) {
      return { status: 'failed', message: messages.duplicateInstance };
    }
    return { status: 'failed', message: messages.saveFailed };
  }
}
