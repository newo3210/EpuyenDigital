import { describe, expect, it } from 'vitest';
import type { QueueCard } from '@/contracts/inbox';
import { filterQueueCards, sortQueueCards } from './queue-sort';

function card(partial: Partial<QueueCard> & Pick<QueueCard, 'id' | 'enteredQueueAt'>): QueueCard {
  return {
    orgId: '00000000-0000-4000-8000-000000000001',
    lineId: '00000000-0000-4000-8000-000000000002',
    phoneNormalized: '5492944216586',
    areaId: '00000000-0000-4000-8000-000000000010',
    ownerUserId: null,
    queueColumn: 'new',
    botState: 'active',
    needsResponse: false,
    awaitingAcceptance: false,
    pendingAreaId: null,
    delegatedFromUserId: null,
    lastMessageAt: null,
    hasAttachments: false,
    citizenId: null,
    slaStatus: 'ok',
    ...partial,
  };
}

describe('sortQueueCards', () => {
  it('orders two unowned conversations by entered_queue_at FIFO', () => {
    const older = card({
      id: '00000000-0000-4000-8000-000000000101',
      enteredQueueAt: '2026-11-07T10:00:00.000Z',
    });
    const newer = card({
      id: '00000000-0000-4000-8000-000000000102',
      enteredQueueAt: '2026-11-07T11:00:00.000Z',
    });
    expect(sortQueueCards([newer, older]).map((c) => c.id)).toEqual([older.id, newer.id]);
  });

  it('places unowned before owned', () => {
    const unowned = card({
      id: '00000000-0000-4000-8000-000000000103',
      enteredQueueAt: '2026-11-07T12:00:00.000Z',
    });
    const owned = card({
      id: '00000000-0000-4000-8000-000000000104',
      enteredQueueAt: '2026-11-07T09:00:00.000Z',
      ownerUserId: '00000000-0000-4000-8000-000000000099',
      lastInboundAt: '2026-11-07T13:00:00.000Z',
    });
    expect(sortQueueCards([owned, unowned])[0]?.id).toBe(unowned.id);
  });
});

describe('filterQueueCards', () => {
  it('filters awaiting my acceptance', () => {
    const me = '00000000-0000-4000-8000-000000000099';
    const mine = card({
      id: '00000000-0000-4000-8000-000000000105',
      enteredQueueAt: '2026-11-07T10:00:00.000Z',
      ownerUserId: me,
      awaitingAcceptance: true,
    });
    const other = card({
      id: '00000000-0000-4000-8000-000000000106',
      enteredQueueAt: '2026-11-07T10:00:00.000Z',
      ownerUserId: '00000000-0000-4000-8000-000000000098',
      awaitingAcceptance: true,
    });
    expect(
      filterQueueCards([mine, other], { awaitingMyAcceptance: true, currentUserId: me }),
    ).toEqual([mine]);
  });
});
