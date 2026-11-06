import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { getConversationThread } from '@/infrastructure/repositories/conversations';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { ConversationThreadView } from '@/presentation/whatsapp/conversation-thread';

type PageProps = {
  params: Promise<{ conversationId: string }>;
};

export const metadata: Metadata = { title: esAR.inbox.threadTitle };

// Inbox thread - message history + minimal text composer.
export default async function InboxThreadPage({ params }: PageProps) {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const { conversationId } = await params;
  const supabase = await createServerSupabase();
  const thread = await getConversationThread(supabase, conversationId);
  if (!thread) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/inbox" className="text-sm text-brand-700 hover:underline">
        {esAR.inbox.backToList}
      </Link>
      <ConversationThreadView thread={thread} />
    </div>
  );
}
