import type { QueueCard } from '@/contracts/inbox';
import { esAR } from '@/i18n/es-AR';
import { QueueCardView } from './queue-card';

const copy = esAR.inbox;

type ConversationListProps = {
  conversations: QueueCard[];
};

// ConversationList - FIFO triage queue with card flags + SLA.
export function ConversationList({ conversations }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center">
        <h2 className="text-lg font-semibold">{copy.emptyTitle}</h2>
        <p className="mt-2 text-sm text-muted">{copy.emptyDescription}</p>
      </div>
    );
  }

  const byColumn = {
    new: conversations.filter((c) => c.queueColumn === 'new'),
    claimed: conversations.filter((c) => c.queueColumn === 'claimed'),
    in_progress: conversations.filter((c) => c.queueColumn === 'in_progress'),
    waiting_external: conversations.filter((c) => c.queueColumn === 'waiting_external'),
  } as const;

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {(Object.keys(byColumn) as Array<keyof typeof byColumn>).map((column) => (
        <section key={column} className="rounded-xl border border-line bg-surface">
          <header className="border-b border-line px-4 py-2 text-sm font-semibold">
            {copy.columns[column]}
            <span className="ml-2 text-xs font-normal text-muted">
              {byColumn[column].length}
            </span>
          </header>
          <ul>
            {byColumn[column].length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-muted">—</li>
            ) : (
              byColumn[column].map((card) => <QueueCardView key={card.id} card={card} />)
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
