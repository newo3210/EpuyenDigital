import type { ConversationThread } from '@/contracts/conversations';
import { esAR } from '@/i18n/es-AR';
import { MessageComposer } from './message-composer';

const copy = esAR.inbox;

type ConversationThreadViewProps = {
  thread: ConversationThread;
};

// ConversationThreadView - read-only messages + composer (no claim/delegate).
export function ConversationThreadView({ thread }: ConversationThreadViewProps) {
  const title =
    thread.conversation.citizenPushName ?? thread.conversation.phoneNormalized;

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-line pb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{copy.channelNote}</p>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted">{thread.conversation.phoneNormalized}</p>
      </header>

      <ol className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
        {thread.messages.length === 0 ? (
          <li className="text-sm text-muted">{copy.threadEmpty}</li>
        ) : (
          thread.messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.direction === 'outbound'
                  ? 'ml-auto bg-brand-700 text-white'
                  : 'mr-auto bg-surface border border-line'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">
                {message.body ?? `[${message.kind}]`}
              </p>
              {message.kind === 'location' && message.latitude != null && message.longitude != null ? (
                <p className="mt-1 text-xs opacity-80">
                  {message.latitude}, {message.longitude}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] opacity-70">
                {new Date(message.createdAt).toLocaleString('es-AR')}
                {message.direction === 'outbound' && message.deliveryStatus
                  ? ` · ${message.deliveryStatus}`
                  : ''}
              </p>
            </li>
          ))
        )}
      </ol>

      <MessageComposer conversationId={thread.conversation.id} />
    </div>
  );
}
