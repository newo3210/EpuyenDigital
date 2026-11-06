import {
  decryptSecret,
  encryptSecret,
  looksLikeCiphertext,
  type Database,
} from '@epuyen/shared';
import { whatsappLineSchema, type WhatsappLine } from '@/contracts/whatsapp-lines';
import { RepositoryError, type DbClient } from './errors';

// Row shape - public.whatsapp_lines (+ secret presence flags).
type LineRow = Database['public']['Tables']['whatsapp_lines']['Row'] & {
  evolution_base_url?: string | null;
  default_area_id?: string | null;
  last_status_at?: string | null;
};

const LINE_COLUMNS =
  'id, org_id, name, display_phone, evolution_base_url, evolution_instance, default_area_id, status, last_status_at';

function requireEncryptionKey(): string {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) throw new RepositoryError('lines.encryption_key_missing', 'CREDENTIALS_ENCRYPTION_KEY');
  return key;
}

function toLine(
  row: LineRow,
  flags: { hasApiKey: boolean; hasWebhookSecret: boolean },
): WhatsappLine {
  const parsed = whatsappLineSchema.safeParse({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    displayPhone: row.display_phone,
    evolutionBaseUrl: row.evolution_base_url ?? null,
    evolutionInstance: row.evolution_instance,
    defaultAreaId: row.default_area_id ?? null,
    status: row.status,
    lastStatusAt: row.last_status_at ?? null,
    hasApiKey: flags.hasApiKey,
    hasWebhookSecret: flags.hasWebhookSecret,
  });
  if (!parsed.success) throw new RepositoryError('lines.invalid_row', parsed.error.message);
  return parsed.data;
}

async function secretFlags(
  client: DbClient,
  lineId: string,
): Promise<{ hasApiKey: boolean; hasWebhookSecret: boolean }> {
  const { data, error } = await client
    .from('whatsapp_line_secrets')
    .select('api_key_ciphertext, webhook_secret_ciphertext, webhook_secret')
    .eq('line_id', lineId)
    .maybeSingle();
  if (error) throw new RepositoryError('lines.secrets_read_failed', error.message);
  return {
    hasApiKey: Boolean(data?.api_key_ciphertext),
    hasWebhookSecret: Boolean(
      data?.webhook_secret_ciphertext || data?.webhook_secret,
    ),
  };
}

// List - organization lines (non-secret fields) visible under RLS.
export async function listWhatsappLines(client: DbClient): Promise<WhatsappLine[]> {
  const { data, error } = await client
    .from('whatsapp_lines')
    .select(LINE_COLUMNS)
    .order('name', { ascending: true });
  if (error) throw new RepositoryError('lines.read_failed', error.message);
  const rows = (data ?? []) as LineRow[];
  const result: WhatsappLine[] = [];
  for (const row of rows) {
    const flags = await secretFlags(client, row.id);
    result.push(toLine(row, flags));
  }
  return result;
}

export async function findWhatsappLineById(
  client: DbClient,
  lineId: string,
): Promise<WhatsappLine | null> {
  const { data, error } = await client
    .from('whatsapp_lines')
    .select(LINE_COLUMNS)
    .eq('id', lineId)
    .maybeSingle();
  if (error) throw new RepositoryError('lines.read_failed', error.message);
  if (!data) return null;
  const flags = await secretFlags(client, data.id);
  return toLine(data as LineRow, flags);
}

export type LineWriteInput = {
  name: string;
  display_phone: string;
  evolution_base_url: string;
  evolution_instance: string;
  default_area_id: string | null;
};

// insertLine - admin RLS insert; secrets written via service role helper.
export async function insertLine(
  client: DbClient,
  orgId: string,
  input: LineWriteInput,
): Promise<string> {
  const { data, error } = await client
    .from('whatsapp_lines')
    .insert({
      org_id: orgId,
      name: input.name,
      display_phone: input.display_phone,
      evolution_base_url: input.evolution_base_url,
      evolution_instance: input.evolution_instance,
      default_area_id: input.default_area_id,
      status: 'disconnected',
    })
    .select('id')
    .single();
  if (error || !data?.id) throw new RepositoryError('lines.insert_failed', error?.message ?? 'no row');
  return data.id as string;
}

export async function updateLine(
  client: DbClient,
  lineId: string,
  input: LineWriteInput,
): Promise<void> {
  const { data, error } = await client
    .from('whatsapp_lines')
    .update({
      name: input.name,
      display_phone: input.display_phone,
      evolution_base_url: input.evolution_base_url,
      evolution_instance: input.evolution_instance,
      default_area_id: input.default_area_id,
    })
    .eq('id', lineId)
    .select('id');
  if (error) throw new RepositoryError('lines.update_failed', error.message);
  if (!data?.[0]) throw new RepositoryError('lines.update_failed', 'no line row was written');
}

export async function updateLineStatus(
  client: DbClient,
  lineId: string,
  status: 'connected' | 'disconnected' | 'error',
): Promise<void> {
  const { error } = await client
    .from('whatsapp_lines')
    .update({ status, last_status_at: new Date().toISOString() })
    .eq('id', lineId);
  if (error) throw new RepositoryError('lines.status_failed', error.message);
}

// upsertLineSecrets - service-role only; stores ciphertext, never returns cleartext.
export async function upsertLineSecrets(
  admin: DbClient,
  lineId: string,
  secrets: { apiKey?: string; webhookSecret?: string },
): Promise<void> {
  const key = requireEncryptionKey();
  const patch: {
    line_id: string;
    api_key_ciphertext?: string | null;
    webhook_secret_ciphertext?: string | null;
    webhook_secret?: string | null;
  } = { line_id: lineId };
  if (secrets.apiKey && secrets.apiKey.trim()) {
    patch.api_key_ciphertext = encryptSecret(secrets.apiKey.trim(), key);
  }
  if (secrets.webhookSecret && secrets.webhookSecret.trim()) {
    patch.webhook_secret_ciphertext = encryptSecret(secrets.webhookSecret.trim(), key);
    // Clear legacy plaintext when ciphertext is written
    patch.webhook_secret = null;
  }
  const { error } = await admin.from('whatsapp_line_secrets').upsert(patch, { onConflict: 'line_id' });
  if (error) throw new RepositoryError('lines.secrets_write_failed', error.message);
}

export async function loadDecryptedLineCredentials(
  admin: DbClient,
  lineId: string,
): Promise<{ apiKey: string | null; webhookSecret: string | null; baseUrl: string | null; instance: string }> {
  const { data: line, error: lineError } = await admin
    .from('whatsapp_lines')
    .select('evolution_base_url, evolution_instance')
    .eq('id', lineId)
    .maybeSingle();
  if (lineError || !line) throw new RepositoryError('lines.read_failed', lineError?.message ?? 'missing');

  const { data: secret, error: secretError } = await admin
    .from('whatsapp_line_secrets')
    .select('api_key_ciphertext, webhook_secret_ciphertext, webhook_secret')
    .eq('line_id', lineId)
    .maybeSingle();
  if (secretError) throw new RepositoryError('lines.secrets_read_failed', secretError.message);

  const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  let apiKey: string | null = null;
  let webhookSecret: string | null = null;
  if (secret?.api_key_ciphertext && encKey && looksLikeCiphertext(secret.api_key_ciphertext)) {
    apiKey = decryptSecret(secret.api_key_ciphertext, encKey);
  }
  if (secret?.webhook_secret_ciphertext && encKey && looksLikeCiphertext(secret.webhook_secret_ciphertext)) {
    webhookSecret = decryptSecret(secret.webhook_secret_ciphertext, encKey);
  } else if (secret?.webhook_secret) {
    webhookSecret = secret.webhook_secret as string;
  }

  return {
    apiKey,
    webhookSecret,
    baseUrl: (line.evolution_base_url as string | null) ?? null,
    instance: line.evolution_instance as string,
  };
}
