import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import {
  listInboxQueue,
  loadOrgSlaSettings,
} from '@/infrastructure/repositories/inbox-queue';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { ConversationList } from '@/presentation/whatsapp/conversation-list';
import { InboxFiltersForm } from '@/presentation/whatsapp/inbox-filters';
import { InboxRealtimeProvider } from '@/presentation/whatsapp/inbox-realtime';

export const metadata: Metadata = { title: esAR.nav.inbox };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function flag(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) return value.includes('1');
  return value === '1';
}

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

// Inbox list - FIFO unowned-first triage queue with filters, SLA, realtime.
export default async function InboxPage({ searchParams }: PageProps) {
  const operator = await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const sla = await loadOrgSlaSettings(supabase, operator.orgId);

  const conversations = await listInboxQueue(supabase, {
    currentUserId: operator.id,
    businessHours: sla.businessHours,
    holidays: sla.holidays,
    filters: {
      areaId: one(params.areaId),
      lineId: one(params.lineId),
      ownerUserId: one(params.ownerUserId),
      awaitingMyAcceptance: flag(params.awaitingMyAcceptance),
      needsResponse: flag(params.needsResponse),
      hasAttachments: flag(params.hasAttachments),
    },
  });

  const [{ data: areas }, { data: lines }, { data: owners }] = await Promise.all([
    supabase.from('areas').select('id, name').eq('is_active', true).order('name'),
    supabase.from('whatsapp_lines').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{esAR.inbox.title}</h1>
          <p className="mt-1 text-sm text-muted">{esAR.inbox.subtitle}</p>
        </div>
        <InboxRealtimeProvider orgId={operator.orgId} currentUserId={operator.id} />
      </header>

      <Suspense fallback={null}>
        <InboxFiltersForm
          areas={(areas ?? []).map((a) => ({ id: a.id as string, name: a.name as string }))}
          lines={(lines ?? []).map((l) => ({ id: l.id as string, name: l.name as string }))}
          owners={(owners ?? []).map((o) => ({
            id: o.id as string,
            name: (o.full_name as string) ?? '',
          }))}
        />
      </Suspense>

      <ConversationList conversations={conversations} />
    </div>
  );
}
