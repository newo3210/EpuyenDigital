import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { getCitizenProfile } from '@/infrastructure/repositories/citizens';
import { getConversationThread } from '@/infrastructure/repositories/conversations';
import { listConversationEvents, listOperatorOptions, listQuickReplies, markConversationRead } from '@/infrastructure/repositories/inbox';
import { listBotRuns } from '@/infrastructure/repositories/knowledge';
import { listNotes } from '@/infrastructure/repositories/notes';
import { listExternalContacts } from '@/infrastructure/repositories/tasks';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { CitizenFicha } from '@/presentation/citizens/citizen-ficha';
import { BotRunsPanel } from '@/presentation/inbox/bot-runs-panel';
import { ThreadView } from '@/presentation/inbox/thread-view';
import { NotesPanel } from '@/presentation/notes/notes-panel';
import { CreateTaskForm } from '@/presentation/tasks/create-task-form';
import { ExportCaseButton } from '@/presentation/tasks/export-case-button';

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export const metadata: Metadata = { title: esAR.inbox.threadTitle };

// Inbox thread - timeline, media, coordinates, and ownership actions.
export default async function InboxThreadPage({ params }: PageProps) {
  const operator = await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const { conversationId } = await params;
  const supabase = await createServerSupabase();
  const thread = await getConversationThread(supabase, conversationId);
  if (!thread) notFound();

  await markConversationRead(supabase, conversationId).catch(() => undefined);

  const [events, replies, operators, areas, notes, externalContacts, botRuns] = await Promise.all([
    listConversationEvents(supabase, conversationId),
    listQuickReplies(supabase, thread.conversation.areaId),
    listOperatorOptions(supabase),
    listAreas(supabase),
    listNotes(supabase, { conversationId }),
    listExternalContacts(supabase),
    listBotRuns(supabase, conversationId),
  ]);
  const canMutate = operator.role !== 'support';
  const areaOptions = areas.map((area) => ({ id: area.id, label: area.name }));

  const admin = createAdminSupabase();
  const messages = await Promise.all(
    thread.messages.map(async (message) => {
      if (!message.storagePath) return message;
      const signed = await admin.storage.from('whatsapp-media').createSignedUrl(message.storagePath, 600);
      return { ...message, mediaHref: signed.data?.signedUrl ?? null };
    }),
  );

  const profile = thread.conversation.citizenId
    ? await getCitizenProfile(supabase, thread.conversation.citizenId)
    : null;
  const editor = (
    <div className="flex flex-col gap-4">
      {profile && !profile.mergedIntoId ? (
        <CitizenFicha
          profile={profile}
          timeline={{ messages: [], events: [], animals: [], notes: [], tasks: [] }}
          canMutate={canMutate}
          showTimeline={false}
          showMerge={false}
        />
      ) : null}
      {canMutate ? (
        <CreateTaskForm
          conversationId={conversationId}
          areas={areaOptions}
          operators={operators}
          externalContacts={externalContacts}
        />
      ) : null}
      <NotesPanel
        notes={notes}
        canMutate={canMutate}
        conversationId={conversationId}
        citizenId={thread.conversation.citizenId ?? undefined}
      />
      <BotRunsPanel runs={botRuns} />
      <ExportCaseButton conversationId={conversationId} />
    </div>
  );

  let ownerName: string | null = null;
  if (thread.conversation.ownerUserId) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', thread.conversation.ownerUserId)
      .maybeSingle();
    ownerName = data?.full_name ?? null;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/inbox" className="text-sm text-brand-700 hover:underline">
        {esAR.inbox.backToList}
      </Link>
      <ThreadView
        thread={{ ...thread, messages }}
        events={events}
        quickReplies={replies}
        operators={operators}
        areas={areaOptions}
        canMutate={canMutate}
        ownerName={ownerName}
        editor={editor}
      />
    </div>
  );
}
