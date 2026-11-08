import Link from 'next/link';
import type { QueueCard } from '@/contracts/inbox';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox;

type QueueBoardProps = {
  cards: QueueCard[];
  activeId?: string;
};

function formatWhen(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

// Queue board - cards already ordered by the database. Text labels sit next to color.
export function QueueBoard({ cards, activeId }: QueueBoardProps) {
  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center">
        <h2 className="text-lg font-semibold">{copy.emptyTitle}</h2>
        <p className="mt-2 text-sm text-muted">{copy.emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {cards.map((card) => {
        const title = card.citizenPushName ?? card.phoneNormalized;
        const registered = card.registrationStatus === 'registered';
        return (
          <li key={card.id}>
            <Link
              href={`/inbox/${card.id}`}
              className={`flex flex-col gap-2 px-4 py-3 hover:bg-canvas ${card.id === activeId ? 'bg-canvas' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{title}</span>
                <span className="text-xs text-muted">{formatWhen(card.lastMessageAt)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-muted">{card.lastMessagePreview ?? card.phoneNormalized}</p>
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-canvas px-2 py-0.5">{card.areaName}</span>
                <span className="rounded bg-canvas px-2 py-0.5">
                  {copy.columns[card.queueColumn as keyof typeof copy.columns] ?? card.queueColumn}
                </span>
                <span className="rounded bg-canvas px-2 py-0.5">
                  {registered ? copy.flags.registered : copy.flags.unregistered}
                </span>
                <span className="rounded bg-canvas px-2 py-0.5">{card.ownerName ?? copy.flags.unowned}</span>
                <span className="rounded bg-canvas px-2 py-0.5">
                  {copy.bot[card.botState as keyof typeof copy.bot] ?? card.botState}
                </span>
                {card.needsResponse ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">{copy.needsResponse}</span>
                ) : null}
                {card.awaitingAcceptance ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">{copy.flags.pending}</span>
                ) : null}
                {card.hasAttachments ? (
                  <span className="rounded bg-canvas px-2 py-0.5">{copy.flags.attachments}</span>
                ) : null}
                {card.unread ? <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-800">{copy.unread}</span> : null}
                {card.slaLevel === 'ok' ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">{copy.flags.slaOk}</span>
                ) : null}
                {card.slaLevel === 'warning' ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">{copy.flags.slaWarning}</span>
                ) : null}
                {card.slaLevel === 'critical' ? (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-red-900">{copy.flags.slaCritical}</span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
