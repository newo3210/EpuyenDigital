import type { ReactNode } from 'react';
import Link from 'next/link';
import type { ConversationThread } from '@/contracts/conversations';
import type { InboxEvent, InboxOption, QuickReply } from '@/contracts/inbox';
import { esAR } from '@/i18n/es-AR';
import { MessageComposer } from '@/presentation/whatsapp/message-composer';
import { ThreadActions } from './thread-actions';

const copy = esAR.inbox;

type ThreadViewProps = {
  thread: ConversationThread;
  events: InboxEvent[];
  quickReplies: QuickReply[];
  operators: InboxOption[];
  areas: InboxOption[];
  canMutate: boolean;
  ownerName?: string | null;
  editor?: ReactNode;
};

function tickLabel(status: string | null, deliveredAt?: string | null, readAt?: string | null): string | null {
  if (!status) return null;
  const labels = copy.ticks as Record<string, string>;
  const label = labels[status] ?? status;
  const when = readAt ?? deliveredAt;
  return when ? `${label} · ${new Date(when).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}` : label;
}

function mapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

// Thread view - messages, ticks, both coordinate kinds, events, and actions.
export function ThreadView({
  thread,
  events,
  quickReplies,
  operators,
  areas,
  canMutate,
  ownerName,
  editor,
}: ThreadViewProps) {
  const title = thread.conversation.citizenPushName ?? thread.conversation.phoneNormalized;
  const home = thread.citizen;
  const inquiries = thread.messages.filter((message) => message.latitude != null && message.longitude != null);

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-line pb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{copy.channelNote}</p>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted">
          {thread.conversation.phoneNormalized}
          {ownerName ? ` · ${ownerName}` : ''}
        </p>
        {thread.conversation.citizenId ? (
          <Link href={`/citizens/${thread.conversation.citizenId}`} className="text-sm text-brand-700 hover:underline">
            {esAR.citizens.openProfile}
          </Link>
        ) : null}
      </header>
      {editor}

      <ol className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
        {thread.messages.length === 0 ? (
          <li className="text-sm text-muted">{copy.threadEmpty}</li>
        ) : (
          thread.messages.map((message) => {
            const tick =
              message.direction === 'outbound'
                ? tickLabel(message.deliveryStatus, message.deliveredAt, message.readAt)
                : null;
            return (
              <li
                key={message.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.direction === 'outbound'
                    ? 'ml-auto bg-brand-700 text-white'
                    : 'mr-auto border border-line bg-surface'
                }`}
              >
                {message.mediaHref && (message.kind === 'image' || message.kind === 'sticker') ? (
                  <img src={message.mediaHref} alt={message.kind} className="mb-2 max-h-64 rounded" />
                ) : null}
                {message.mediaHref && message.kind === 'audio' ? (
                  <audio controls src={message.mediaHref} className="mb-2 w-full" />
                ) : null}
                {message.mediaHref && message.kind === 'document' ? (
                  <a className="mb-2 underline" href={message.mediaHref}>
                    {message.body ?? message.kind}
                  </a>
                ) : null}
                {!message.mediaHref && message.storagePath ? <p className="text-xs opacity-80">[{message.kind}]</p> : null}
                {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
                {tick ? <p className="mt-1 text-[11px] opacity-80">{tick}</p> : null}
              </li>
            );
          })
        )}
      </ol>

      {inquiries.length > 0 || (home?.latitude != null && home.longitude != null) ? (
        <section className="rounded-xl border border-line p-3 text-sm">
          <h2 className="font-medium">{copy.coords.title}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {inquiries.map((message) => (
              <li key={message.id}>
                <a
                  className="text-brand-700 underline"
                  href={mapLink(message.latitude as number, message.longitude as number)}
                >
                  {copy.coords.inquiry}: {copy.coords.openMap}
                </a>
              </li>
            ))}
            {home?.latitude != null && home.longitude != null ? (
              <li>
                <a className="text-brand-700 underline" href={mapLink(home.latitude, home.longitude)}>
                  {copy.coords.home}: {copy.coords.openMap}
                </a>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium">{copy.eventsTitle}</h2>
        <ol className="mt-2 flex flex-col gap-1 text-xs text-muted">
          {events.map((event) => (
            <li key={event.id}>
              {new Date(event.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} ·{' '}
              {event.eventType}
              {event.note ? ` · ${event.note}` : ''}
            </li>
          ))}
        </ol>
      </section>

      <ThreadActions
        conversationId={thread.conversation.id}
        canMutate={canMutate}
        operators={operators}
        areas={areas}
      />
      <MessageComposer conversationId={thread.conversation.id} quickReplies={quickReplies} canSend={canMutate} />
    </div>
  );
}
