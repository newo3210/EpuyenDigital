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

  const [quickReplies, areasResult, membershipsResult, areaMemberIdsResult, profilesResult] =
    await Promise.all([
      listQuickReplies(supabase, thread.conversation.areaId),
      supabase.from('areas').select('id, name').eq('is_active', true).order('name'),
      supabase
        .from('area_members')
        .select('area_id, is_lead')
        .eq('user_id', operator.id),
      // Restrict user-delegate targets to members of the conversation's current area
      // (avoids cross-area accept → AREA_FORBIDDEN on ensure_owner / transitions).
      supabase
        .from('area_members')
        .select('user_id')
        .eq('area_id', thread.conversation.areaId),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .neq('id', operator.id)
        .order('full_name'),
    ]);

  const callerMemberships = membershipsResult.data ?? [];
  const callerAreaIds = callerMemberships.map((m) => m.area_id as string);
  const isLeadOfPending = Boolean(
    thread.conversation.pendingAreaId &&
      callerMemberships.some(
        (m) => m.area_id === thread.conversation.pendingAreaId && m.is_lead,
      ),
  );

  const areaMemberIds = new Set(
    (areaMemberIdsResult.data ?? []).map((m) => m.user_id as string),
  );
  const operators = (profilesResult.data ?? [])
    .filter((o) => areaMemberIds.has(o.id as string))
    .map((o) => ({
      id: o.id as string,
      fullName: (o.full_name as string) ?? '',
    }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/inbox" className="text-sm text-brand-700 hover:underline">
          {esAR.inbox.backToList}
        </Link>
        <InboxRealtimeProvider
          orgId={operator.orgId}
          currentUserId={operator.id}
          callerAreaIds={callerAreaIds}
        />
      </div>
      <ConversationThreadView
        thread={thread}
        currentUserId={operator.id}
        callerAreaIds={callerAreaIds}
        isAdmin={operator.role === 'admin'}
        isAreaLead={operator.role === 'area_lead' || isLeadOfPending}
        quickReplies={quickReplies}
        areas={(areasResult.data ?? []).map((a) => ({
          id: a.id as string,
          name: a.name as string,
        }))}
        operators={operators}
      />
    </div>
  );
}
