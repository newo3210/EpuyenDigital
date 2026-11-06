import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listConversations } from '@/infrastructure/repositories/conversations';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { ConversationList } from '@/presentation/whatsapp/conversation-list';

export const metadata: Metadata = { title: esAR.nav.inbox };

// Inbox list - channel conversations for the org (claim/delegate deferred to mesa-entrada-inbox).
export default async function InboxPage() {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const supabase = await createServerSupabase();
  const conversations = await listConversations(supabase);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{esAR.inbox.title}</h1>
        <p className="mt-1 text-sm text-muted">{esAR.inbox.subtitle}</p>
      </header>
      <ConversationList conversations={conversations} />
    </div>
  );
}
