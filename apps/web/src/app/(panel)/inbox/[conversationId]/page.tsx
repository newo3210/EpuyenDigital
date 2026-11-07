import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listQuickReplies } from '@/infrastructure/repositories/inbox-queue';
import { getConversationThread } from '@/infrastructure/repositories/conversations';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { ConversationThreadView } from '@/presentation/whatsapp/conversation-thread';
import { InboxRealtimeProvider } from '@/presentation/whatsapp/inbox-realtime';

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export const metadata: Metadata = { title: esAR.inbox.threadTitle };

// Inbox thread - timeline, delivery ticks, triage actions, composer + quick replies.
export default async function InboxThreadPage({ params }: PageProps) {
  const operator = await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const { conversationId } = await params;
  const supabase = await createServerSupabase();
  const thread = await getConversationThread(supabase, conversationId);
  if (!thread) notFound();

  const [quickReplies, areasResult, operatorsResult] = await Promise.all([
    listQuickReplies(supabase, thread.conversation.areaId),
    supabase.from('areas').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .neq('id', operator.id)
      .order('full_name'),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/inbox" className="text-sm text-brand-700 hover:underline">
          {esAR.inbox.backToList}
        </Link>
        <InboxRealtimeProvider orgId={operator.orgId} currentUserId={operator.id} />
      </div>
      <ConversationThreadView
        thread={thread}
        currentUserId={operator.id}
        quickReplies={quickReplies}
        areas={(areasResult.data ?? []).map((a) => ({
          id: a.id as string,
          name: a.name as string,
        }))}
        operators={(operatorsResult.data ?? []).map((o) => ({
          id: o.id as string,
          fullName: (o.full_name as string) ?? '',
        }))}
      />
    </div>
  );
}
