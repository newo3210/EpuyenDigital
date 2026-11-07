import type { QueueCard } from '@/contracts/inbox';

function slaRank(status: QueueCard['slaStatus']): number {
  if (status === 'critical') return 2;
  if (status === 'warning') return 1;
  return 0;
}

function needsRank(card: QueueCard): number {
  return card.needsResponse ? 1 : 0;
}

// sortQueueCards - unowned FIFO by entered_queue_at, then owned by last_inbound desc.
// Within each group, needs_response and critical SLA sort higher.
export function sortQueueCards(cards: QueueCard[]): QueueCard[] {
  const unowned = cards.filter((c) => c.ownerUserId == null);
  const owned = cards.filter((c) => c.ownerUserId != null);

  unowned.sort((a, b) => {
    const needs = needsRank(b) - needsRank(a);
    if (needs !== 0) return needs;
    const sla = slaRank(b.slaStatus) - slaRank(a.slaStatus);
    if (sla !== 0) return sla;
    return new Date(a.enteredQueueAt).getTime() - new Date(b.enteredQueueAt).getTime();
  });

  owned.sort((a, b) => {
    const needs = needsRank(b) - needsRank(a);
    if (needs !== 0) return needs;
    const sla = slaRank(b.slaStatus) - slaRank(a.slaStatus);
    if (sla !== 0) return sla;
    const aIn = a.lastInboundAt ? new Date(a.lastInboundAt).getTime() : 0;
    const bIn = b.lastInboundAt ? new Date(b.lastInboundAt).getTime() : 0;
    return bIn - aIn;
  });

  return [...unowned, ...owned];
}

// filterQueueCards - client-side filters for area/line/owner/awaiting/needs/attachments.
export function filterQueueCards(
  cards: QueueCard[],
  filters: {
    areaId?: string;
    lineId?: string;
    ownerUserId?: string;
    awaitingMyAcceptance?: boolean;
    needsResponse?: boolean;
    hasAttachments?: boolean;
    currentUserId?: string;
  },
): QueueCard[] {
  return cards.filter((card) => {
    if (filters.areaId && card.areaId !== filters.areaId) return false;
    if (filters.lineId && card.lineId !== filters.lineId) return false;
    if (filters.ownerUserId && card.ownerUserId !== filters.ownerUserId) return false;
    if (filters.awaitingMyAcceptance) {
      if (!filters.currentUserId) return false;
      if (!(card.awaitingAcceptance && card.ownerUserId === filters.currentUserId)) return false;
    }
    if (filters.needsResponse && !card.needsResponse) return false;
    if (filters.hasAttachments && !card.hasAttachments) return false;
    return true;
  });
}
