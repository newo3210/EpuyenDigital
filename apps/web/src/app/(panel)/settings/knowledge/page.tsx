import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { getOrgBotPaused, listKnowledgeDocuments } from '@/infrastructure/repositories/knowledge';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { KnowledgeAdmin } from '@/presentation/knowledge/knowledge-admin';

export const metadata: Metadata = { title: esAR.knowledge.title };

// Knowledge settings - admin corpus and global bot pause.
export default async function KnowledgeSettingsPage() {
  await requirePageRole(['admin']);
  const supabase = await createServerSupabase();
  const [documents, botPaused] = await Promise.all([
    listKnowledgeDocuments(supabase),
    getOrgBotPaused(supabase),
  ]);
  return <KnowledgeAdmin documents={documents} botPaused={botPaused} />;
}
