import type { SupabaseClient } from '@supabase/supabase-js';

export type KnowledgeDocumentListItem = {
  id: string;
  title: string;
  sourceKind: string;
  isActive: boolean;
  indexStatus: string;
  validUntil: string | null;
  areaId: string | null;
  updatedAt: string;
};

export type BotRunListItem = {
  id: string;
  decision: string;
  answer: string | null;
  confidence: number | null;
  handoffReason: string | null;
  sources: unknown;
  topic: string | null;
  urgency: string | null;
  createdAt: string;
};

// listKnowledgeDocuments - admin corpus list via definer RPC.
export async function listKnowledgeDocuments(
  client: SupabaseClient,
): Promise<KnowledgeDocumentListItem[]> {
  const { data, error } = await client.rpc('list_knowledge_documents');
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.result_id as string,
    title: row.result_title as string,
    sourceKind: row.result_source_kind as string,
    isActive: Boolean(row.result_is_active),
    indexStatus: row.result_index_status as string,
    validUntil: (row.result_valid_until as string | null) ?? null,
    areaId: (row.result_area_id as string | null) ?? null,
    updatedAt: row.result_updated_at as string,
  }));
}

// listBotRuns - thread decision log visible to operators with conversation access.
export async function listBotRuns(
  client: SupabaseClient,
  conversationId: string,
): Promise<BotRunListItem[]> {
  const { data, error } = await client.rpc('list_bot_runs', {
    p_conversation_id: conversationId,
  });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.result_id as string,
    decision: row.result_decision as string,
    answer: (row.result_answer as string | null) ?? null,
    confidence: row.result_confidence == null ? null : Number(row.result_confidence),
    handoffReason: (row.result_handoff_reason as string | null) ?? null,
    sources: row.result_sources,
    topic: (row.result_topic as string | null) ?? null,
    urgency: (row.result_urgency as string | null) ?? null,
    createdAt: row.result_created_at as string,
  }));
}

export async function getOrgBotPaused(client: SupabaseClient): Promise<boolean> {
  const { data } = await client.from('org_settings').select('bot_paused').maybeSingle();
  return Boolean(data?.bot_paused);
}
