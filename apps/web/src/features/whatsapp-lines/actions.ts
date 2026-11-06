'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { HttpEvolutionClient } from '@/infrastructure/evolution/client';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import {
  findWhatsappLineById,
  insertLine,
  loadDecryptedLineCredentials,
  updateLine as updateLineRow,
  updateLineStatus,
  upsertLineSecrets,
} from '@/infrastructure/repositories/whatsapp-lines';
import { createLine } from './create-line';
import { testLineConnection } from './test-connection';
import { updateLine } from './update-line';

const ADMIN_ROLES = ['admin'] as const;

export type LineFormState = {
  status?: 'ok' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

function readOptionalText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// Create-line action - admin RLS for line row; service role for encrypted secrets.
export async function createLineAction(
  _previous: LineFormState,
  formData: FormData,
): Promise<LineFormState> {
  const operator = await requirePageRole(ADMIN_ROLES);
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  const result = await createLine(
    {
      name: readOptionalText(formData, 'name'),
      displayPhone: readOptionalText(formData, 'displayPhone'),
      evolutionBaseUrl: readOptionalText(formData, 'evolutionBaseUrl'),
      evolutionInstance: readOptionalText(formData, 'evolutionInstance'),
      defaultAreaId: readOptionalText(formData, 'defaultAreaId'),
      apiKey: readOptionalText(formData, 'apiKey'),
      webhookSecret: readOptionalText(formData, 'webhookSecret'),
    },
    {
      orgId: operator.orgId,
      insertLine: (orgId, input) => insertLine(supabase, orgId, input),
      upsertSecrets: (lineId, secrets) => upsertLineSecrets(admin, lineId, secrets),
      loadLine: (lineId) => findWhatsappLineById(supabase, lineId),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/settings/lines');
  return { status: 'ok', message: esAR.lines.saved };
}

// Update-line action - optional secret rotation when fields filled.
export async function updateLineAction(
  _previous: LineFormState,
  formData: FormData,
): Promise<LineFormState> {
  await requirePageRole(ADMIN_ROLES);
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  const result = await updateLine(
    {
      id: readOptionalText(formData, 'id'),
      name: readOptionalText(formData, 'name'),
      displayPhone: readOptionalText(formData, 'displayPhone'),
      evolutionBaseUrl: readOptionalText(formData, 'evolutionBaseUrl'),
      evolutionInstance: readOptionalText(formData, 'evolutionInstance'),
      defaultAreaId: readOptionalText(formData, 'defaultAreaId'),
      apiKey: readOptionalText(formData, 'apiKey'),
      webhookSecret: readOptionalText(formData, 'webhookSecret'),
    },
    {
      updateLine: (lineId, input) => updateLineRow(supabase, lineId, input),
      upsertSecrets: (lineId, secrets) => upsertLineSecrets(admin, lineId, secrets),
      loadLine: (lineId) => findWhatsappLineById(supabase, lineId),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/settings/lines');
  return { status: 'ok', message: esAR.lines.saved };
}

export type TestConnectionState = {
  status?: 'ok' | 'error';
  message?: string;
};

// Probar conexión - updates status; surfaces non-secret error summary only.
export async function testConnectionAction(
  _previous: TestConnectionState,
  formData: FormData,
): Promise<TestConnectionState> {
  await requirePageRole(ADMIN_ROLES);
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const lineId = readOptionalText(formData, 'id');
  if (!lineId) return { status: 'error', message: esAR.lines.errors.idRequired };

  const result = await testLineConnection(lineId, {
    loadCredentials: (id) => loadDecryptedLineCredentials(admin, id),
    testConnection: async ({ baseUrl, apiKey, instance }) => {
      const client = new HttpEvolutionClient(baseUrl, apiKey);
      return client.testConnection({ instance });
    },
    updateStatus: (id, status) => updateLineStatus(supabase, id, status),
  });

  revalidatePath('/settings/lines');
  if (result.status === 'failed') return { status: 'error', message: result.message };
  if (result.connected) {
    return { status: 'ok', message: esAR.lines.connectionOk };
  }
  return {
    status: 'error',
    message: `${esAR.lines.connectionFailed}${result.detail ? ` (${result.detail})` : ''}`,
  };
}
