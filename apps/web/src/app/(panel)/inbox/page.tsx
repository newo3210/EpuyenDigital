import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { listInboxQueue } from '@/infrastructure/repositories/inbox';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { QueueBoard } from '@/presentation/inbox/queue-board';
import { QueueFilters } from '@/presentation/inbox/queue-filters';

export const metadata: Metadata = { title: esAR.nav.inbox };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Inbox queue - unowned first, filters in the query string.
export default async function InboxPage({ searchParams }: PageProps) {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const uuidOrEmpty = (value: string | undefined) =>
    value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;
  const filters = {
    areaId: uuidOrEmpty(one(params.areaId)),
    lineId: uuidOrEmpty(one(params.lineId)),
    owner: one(params.owner) || undefined,
    awaitingMine: one(params.awaiting) === '1',
    unanswered: one(params.unanswered) === '1',
    withAttachments: one(params.attachments) === '1',
  };
  const [cards, areas, linesResult] = await Promise.all([
    listInboxQueue(supabase, filters),
    listAreas(supabase),
    supabase.from('whatsapp_lines').select('id, name'),
  ]);
  const lines = (linesResult.data ?? []).map((line) => ({ id: line.id as string, label: line.name as string }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-64">
        <QueueFilters
          areas={areas.map((area) => ({ id: area.id, label: area.name }))}
          lines={lines}
          values={filters}
        />
      </aside>
      <section className="min-w-0 flex-1">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">{esAR.inbox.title}</h1>
          <p className="mt-1 text-sm text-muted">{esAR.inbox.subtitle}</p>
        </header>
        <QueueBoard cards={cards} />
      </section>
    </div>
  );
}
