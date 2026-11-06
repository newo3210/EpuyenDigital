import { lineCreateSchema, type LineCreateInput, type WhatsappLine } from '@/contracts/whatsapp-lines';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.lines.errors;

// Create-line ports - org context, line insert (RLS), secrets write (service role).
export type CreateLineDeps = {
  orgId: string;
  insertLine: (
    orgId: string,
    input: {
      name: string;
      display_phone: string;
      evolution_base_url: string;
      evolution_instance: string;
      default_area_id: string | null;
    },
  ) => Promise<string>;
  upsertSecrets: (lineId: string, secrets: { apiKey: string; webhookSecret: string }) => Promise<void>;
  loadLine: (lineId: string) => Promise<WhatsappLine | null>;
};

export type CreateLineResult =
  | { status: 'ok'; line: WhatsappLine }
  | { status: 'invalid'; fieldErrors: Partial<Record<keyof LineCreateInput, string>> }
  | { status: 'failed'; message: string };

// Create-line use case - validates, inserts line, encrypts secrets server-side.
export async function createLine(input: unknown, deps: CreateLineDeps): Promise<CreateLineResult> {
  const parsed = lineCreateSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: 'invalid',
      fieldErrors: {
        name: flat.name?.[0],
        displayPhone: flat.displayPhone?.[0],
        evolutionBaseUrl: flat.evolutionBaseUrl?.[0],
        evolutionInstance: flat.evolutionInstance?.[0],
        defaultAreaId: flat.defaultAreaId?.[0],
        apiKey: flat.apiKey?.[0],
        webhookSecret: flat.webhookSecret?.[0],
      },
    };
  }

  try {
    const lineId = await deps.insertLine(deps.orgId, {
      name: parsed.data.name,
      display_phone: parsed.data.displayPhone,
      evolution_base_url: parsed.data.evolutionBaseUrl,
      evolution_instance: parsed.data.evolutionInstance,
      default_area_id: parsed.data.defaultAreaId ?? null,
    });
    await deps.upsertSecrets(lineId, {
      apiKey: parsed.data.apiKey!.trim(),
      webhookSecret: parsed.data.webhookSecret!.trim(),
    });
    const line = await deps.loadLine(lineId);
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
