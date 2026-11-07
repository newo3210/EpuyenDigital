'use client';

import { useEffect } from 'react';
import type { ConversationThread } from '@/contracts/conversations';
import type { QuickReply } from '@/contracts/inbox';
import { markThreadReadAction } from '@/features/inbox/actions';
import { resolveInquiryCoords } from '@/features/inbox/inquiry-coords';
import { esAR } from '@/i18n/es-AR';
import { DeliveryTicks } from './delivery-ticks';
import { InquiryMap } from './inquiry-map';
import { MessageComposer } from './message-composer';
import { ThreadActions } from './thread-actions';

const copy = esAR.inbox;

type AreaOption = { id: string; name: string };
type OperatorOption = { id: string; fullName: string };

type ConversationThreadViewProps = {
  thread: ConversationThread;
  currentUserId: string;
  quickReplies: QuickReply[];
  areas: AreaOption[];
  operators: OperatorOption[];
};

// ConversationThreadView - messages, delivery ticks, events, triage actions, map.
export function ConversationThreadView({
  thread,
  currentUserId,
  quickReplies,
  areas,
  operators,
}: ConversationThreadViewProps) {
  const title =
    thread.conversation.citizenPushName ?? thread.conversation.phoneNormalized;
  const coords = resolveInquiryCoords(
    {
      inquiryLatitude: thread.conversation.inquiryLatitude,
      inquiryLongitude: thread.conversation.inquiryLongitude,
    },
    thread.messages,
  );

  const isOwner = thread.conversation.ownerUserId === currentUserId;
  const isPendingTarget = Boolean(
    thread.conversation.awaitingAcceptance &&
      thread.conversation.ownerUserId === currentUserId,
  );

  useEffect(() => {
    const lastId = thread.messages.at(-1)?.id;
    void markThreadReadAction(thread.conversation.id, lastId);
  }, [thread.conversation.id, thread.messages]);

  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-line pb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{copy.channelNote}</p>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted">{thread.conversation.phoneNormalized}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          {thread.conversation.queueColumn ? (
            <span>{copy.columns[thread.conversation.queueColumn]}</span>
          ) : null}
          {thread.conversation.registrationStatus === 'registered'
            ? copy.registered
            : copy.unregistered}
          {thread.conversation.needsResponse ? (
            <span className="font-medium text-brand-700">{copy.needsResponse}</span>
          ) : null}
        </div>
      </header>

      <ThreadActions
        conversationId={thread.conversation.id}
        queueColumn={thread.conversation.queueColumn}
        awaitingAcceptance={thread.conversation.awaitingAcceptance}
        isOwner={Boolean(isOwner && !thread.conversation.awaitingAcceptance)}
        isPendingTarget={isPendingTarget}
        areas={areas}
        operators={operators}
      />

      {coords ? (
        <InquiryMap latitude={coords.latitude} longitude={coords.longitude} />
      ) : null}

      <ol className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
        {thread.messages.length === 0 ? (
          <li className="text-sm text-muted">{copy.threadEmpty}</li>
        ) : (
          thread.messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.direction === 'outbound'
                  ? 'ml-auto bg-brand-700 text-white'
                  : 'mr-auto border border-line bg-surface'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">
                {message.body ?? `[${message.kind}]`}
              </p>
              {message.kind === 'location' &&
              message.latitude != null &&
              message.longitude != null ? (
                <p className="mt-1 text-xs opacity-80">
                  {message.latitude}, {message.longitude}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] opacity-70">
                {new Date(message.createdAt).toLocaleString('es-AR')}
                {message.direction === 'outbound' ? (
                  <DeliveryTicks status={message.deliveryStatus} />
                ) : null}
              </p>
            </li>
          ))
        )}
      </ol>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">{copy.events.title}</h2>
        {(thread.events?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-muted">{copy.events.empty}</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {thread.events?.map((event) => (
              <li key={event.id} className="text-xs text-muted">
                <span className="font-medium text-ink">
                  {copy.events[event.eventType] ?? event.eventType}
                </span>
                {' · '}
                {event.actorName ?? event.actorKind}
                {' · '}
                {new Date(event.createdAt).toLocaleString('es-AR')}
                {event.note ? ` — ${event.note}` : ''}
              </li>
            ))}
          </ol>
        )}
      </section>

      <MessageComposer conversationId={thread.conversation.id} quickReplies={quickReplies} />
    </div>
  );
}
