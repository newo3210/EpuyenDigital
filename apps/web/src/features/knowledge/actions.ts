'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { createServerSupabase } from '@/infrastructure/supabase/server';

export type KnowledgeActionState = {
  status?: 'ok' | 'error';
  message?: string;
};

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// upsertKnowledgeDocumentAction - admin creates/updates a knowledge doc and enqueues indexing.
export async function upsertKnowledgeDocumentAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requirePageRole(['admin']);
  const title = readText(formData, 'title')?.trim() ?? '';
  const bodyText = readText(formData, 'bodyText')?.trim() ?? '';
  const id = readText(formData, 'id') || undefined;
  if (title.length < 2 || bodyText.length < 2) {
    return { status: 'error', message: esAR.knowledge.errors.required };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('upsert_knowledge_document', {
    p_id: id ?? null,
    p_title: title,
    p_source_kind: 'text',
    p_body_text: bodyText,
    p_storage_path: null,
    p_area_id: null,
    p_is_active: true,
    p_valid_until: null,
  });
  if (error) return { status: 'error', message: esAR.knowledge.errors.saveFailed };
  revalidatePath('/settings/knowledge');
  return { status: 'ok', message: esAR.knowledge.saved };
}

// setKnowledgeDocumentActiveAction - activate or deactivate a document for retrieval.
export async function setKnowledgeDocumentActiveAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requirePageRole(['admin']);
  const id = readText(formData, 'id') ?? '';
  const active = readText(formData, 'active') === 'true';
  if (!id) return { status: 'error', message: esAR.knowledge.errors.saveFailed };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('set_knowledge_document_active', {
    p_id: id,
    p_is_active: active,
  });
  if (error) return { status: 'error', message: esAR.knowledge.errors.saveFailed };
  revalidatePath('/settings/knowledge');
  return { status: 'ok', message: active ? esAR.knowledge.activated : esAR.knowledge.deactivated };
}

// reindexKnowledgeDocumentAction - re-enqueue indexing for an existing document.
export async function reindexKnowledgeDocumentAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requirePageRole(['admin']);
  const id = readText(formData, 'id') ?? '';
  if (!id) return { status: 'error', message: esAR.knowledge.errors.saveFailed };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('reindex_knowledge_document', { p_id: id });
  if (error) return { status: 'error', message: esAR.knowledge.errors.saveFailed };
  revalidatePath('/settings/knowledge');
  return { status: 'ok', message: esAR.knowledge.reindexQueued };
}

// setOrgBotPausedAction - global mesa bot kill for the org.
export async function setOrgBotPausedAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  await requirePageRole(['admin']);
  const paused = readText(formData, 'paused') === 'true';
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('set_org_bot_paused', { p_paused: paused });
  if (error) return { status: 'error', message: esAR.knowledge.errors.saveFailed };
  revalidatePath('/settings/knowledge');
  return {
    status: 'ok',
    message: paused ? esAR.knowledge.botPaused : esAR.knowledge.botResumed,
  };
}
