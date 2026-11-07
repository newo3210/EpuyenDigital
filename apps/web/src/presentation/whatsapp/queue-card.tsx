import Link from 'next/link';
import type { QueueCard } from '@/contracts/inbox';
import { resolveInquiryCoords } from '@/features/inbox/inquiry-coords';
import { esAR } from '@/i18n/es-AR';
import { InquiryMap } from './inquiry-map';

const copy = esAR.inbox;

type QueueCardViewProps = {
  card: QueueCard;
};

function slaClass(status: QueueCard['slaStatus']): string {
  if (status === 'critical') return 'text-danger';
  if (status === 'warning') return 'text-amber-700';
  return 'text-muted';
}

// QueueCardView - triage card flags (INB-10) + optional inquiry map.
export function QueueCardView({ card }: QueueCardViewProps) {
  const title = card.citizenPushName ?? card.phoneNormalized;
  const coords = resolveInquiryCoords({
    inquiryLatitude: card.inquiryLatitude,
    inquiryLongitude: card.inquiryLongitude,
  });

  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/inbox/${card.id}`} className="block px-4 py-3 hover:bg-canvas">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {title}
              {card.unread ? (
                <span className="ml-2 text-xs font-semibold text-brand-700">{copy.unread}</span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {card.phoneNormalized}
              {card.lastMessageAt
                ? ` · ${new Date(card.lastMessageAt).toLocaleString('es-AR')}`
                : ''}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-medium ${slaClass(card.slaStatus)}`}>
            {copy.sla[card.slaStatus]}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {card.areaName ? <span>{card.areaName}</span> : null}
          {card.ownerName ? <span>{card.ownerName}</span> : null}
          {card.needsResponse ? (
            <span className="font-medium text-brand-700">{copy.needsResponse}</span>
          ) : null}
          {card.awaitingAcceptance ? (
            <span className="font-medium text-amber-700">{copy.pendingDelegation}</span>
          ) : null}
          <span>
            {card.registrationStatus === 'registered' ? copy.registered : copy.unregistered}
          </span>
          <span>{card.botState === 'active' ? copy.botActive : copy.botPaused}</span>
          {card.hasAttachments ? <span>{copy.hasAttachments}</span> : null}
          <span>{copy.columns[card.queueColumn]}</span>
        </div>

        {card.lastMessagePreview ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted">{card.lastMessagePreview}</p>
        ) : null}
      </Link>
      {coords ? (
        <div className="px-4 pb-3">
          <InquiryMap latitude={coords.latitude} longitude={coords.longitude} />
        </div>
      ) : null}
    </li>
  );
}
