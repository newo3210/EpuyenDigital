import Link from 'next/link';
import type { ConversationListItem } from '@/contracts/conversations';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox;

type ConversationListProps = {
  conversations: ConversationListItem[];
};

// ConversationList - org-scoped channel threads (triage claim UI deferred).
export function ConversationList({ conversations }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center">
        <h2 className="text-lg font-semibold">{copy.emptyTitle}</h2>
        <p className="mt-2 text-sm text-muted">{copy.emptyDescription}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {conversations.map((conversation) => {
        const title = conversation.citizenPushName ?? conversation.phoneNormalized;
        return (
          <li key={conversation.id}>
            <Link
              href={`/inbox/${conversation.id}`}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-canvas"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{title}</span>
                {conversation.needsResponse ? (
                  <span className="text-xs font-medium text-brand-700">{copy.needsResponse}</span>
                ) : null}
              </div>
              <span className="text-xs text-muted">
                {conversation.phoneNormalized}
                {conversation.lastMessageAt
                  ? ` · ${new Date(conversation.lastMessageAt).toLocaleString('es-AR')}`
                  : ''}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
