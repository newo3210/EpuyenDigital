'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { HttpEvolutionClient } from '@/infrastructure/evolution/client';
import { getConversationThread } from '@/infrastructure/repositories/conversations';
import { loadDecryptedLineCredentials } from '@/infrastructure/repositories/whatsapp-lines';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { mapInboxError } from '@/features/inbox/map-error';
import { sendOperatorText } from './send-text';

export type ComposerState = {
  status?: 'ok' | 'error';
  message?: string;
  dryRun?: boolean;
  fieldErrors?: Partial<Record<'text' | 'conversationId', string>>;
};

function readOptionalText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// Send composer text - any authenticated org member with conversation RLS access.
// Persists via service role (authenticated has SELECT-only on messages).
export async function sendComposerTextAction(
  _previous: ComposerState,
  formData: FormData,
): Promise<ComposerState> {
  const operator = await requirePageRole(['admin', 'area_lead', 'operator']);
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const conversationId = readOptionalText(formData, 'conversationId');

  const result = await sendOperatorText(
    {
      conversationId,
      text: readOptionalText(formData, 'text'),
    },
    {
      authorUserId: operator.id,
      ensureOwner: async (id) => {
        const { error } = await supabase.rpc('ensure_owner_for_reply', { p_conversation_id: id });
        if (error) return { ok: false as const, message: mapInboxError(error) };
        return { ok: true as const };
      },
      loadConversation: async (id) => {
        const thread = await getConversationThread(supabase, id);
        if (!thread) return null;
        return {
          id: thread.conversation.id,
          orgId: thread.conversation.orgId,
          lineId: thread.conversation.lineId,
          phoneNormalized: thread.conversation.phoneNormalized,
        };
      },
      loadOrgSendMode: async (orgId) => {
        const { data, error } = await admin
          .from('org_settings')
          .select('send_mode, allowlist_phones')
          .eq('org_id', orgId)
          .maybeSingle();
        if (error) throw error;
        return {
          sendMode: (data?.send_mode as 'dry_run' | 'allowlist' | 'production') ?? 'dry_run',
          allowlistPhones: (data?.allowlist_phones as string[] | null) ?? [],
        };
      },
      loadLineCredentials: (lineId) =>
        loadDecryptedLineCredentials(admin, lineId, operator.orgId),
      persistOutbound: async (params) => {
        const { data, error } = await admin
          .from('messages')
          .insert({
            org_id: params.orgId,
            line_id: params.lineId,
            conversation_id: params.conversationId,
            external_id: params.externalId ?? `local-${crypto.randomUUID()}`,
            direction: 'outbound',
            sender_kind: 'operator',
            author_user_id: params.authorUserId,
            phone_normalized: params.phone,
            kind: 'text',
            body: params.text,
            delivery_status: params.deliveryStatus,
          })
          .select('id')
          .single();
        if (error || !data?.id) throw error ?? new Error('OUTBOUND_PERSIST_FAILED');
        await admin
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_outbound_at: new Date().toISOString(),
            last_message_preview: params.text.slice(0, 140),
            last_message_kind: 'text',
            needs_response: false,
          })
          .eq('id', params.conversationId);
        return { messageId: data.id as string };
      },
      updateOutbound: async ({ messageId, deliveryStatus, externalId }) => {
        const patch: { delivery_status: 'sent' | 'failed'; external_id?: string } = {
          delivery_status: deliveryStatus,
        };
        if (externalId) patch.external_id = externalId;
        const { error } = await admin.from('messages').update(patch).eq('id', messageId);
        if (error) throw error;
      },
      sendViaEvolution: async ({ baseUrl, apiKey, instance, phone, text }) => {
        const client = new HttpEvolutionClient(baseUrl, apiKey);
        return client.sendText({ instance, phone, text });
      },
    },
  );

  if (result.status === 'invalid') {
    return { status: 'error', fieldErrors: result.fieldErrors };
  }
  if (result.status === 'failed') {
    return { status: 'error', message: result.message };
  }

  if (conversationId) {
    revalidatePath(`/inbox/${conversationId}`);
  }
  revalidatePath('/inbox');

  return {
    status: 'ok',
    dryRun: result.dryRun,
    message: result.dryRun ? esAR.inbox.composer.dryRunSaved : esAR.inbox.composer.sent,
  };
}
