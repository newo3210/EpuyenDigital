'use client';

import { useActionState, useState } from 'react';
import type { QuickReply } from '@/contracts/inbox';
import { sendComposerTextAction, type ComposerState } from '@/features/outbound/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.composer;
const repliesCopy = esAR.inbox.quickReplies;

type MessageComposerProps = {
  conversationId: string;
  quickReplies?: QuickReply[];
  canSend?: boolean;
};

// Message composer - text send plus quick replies that only fill the box.
export function MessageComposer({ conversationId, quickReplies = [], canSend = true }: MessageComposerProps) {
  const [state, formAction, pending] = useActionState<ComposerState, FormData>(sendComposerTextAction, {});
  const [text, setText] = useState('');

  if (!canSend) return null;

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      {quickReplies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              className="rounded border border-line px-2 py-1 text-xs"
              onClick={() => setText(reply.body)}
            >
              {repliesCopy.insert}: {reply.title}
            </button>
          ))}
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="sr-only">{copy.label}</span>
        <textarea
          name="text"
          rows={3}
          required
          maxLength={4096}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={copy.placeholder}
          className="rounded-lg border border-line bg-surface px-3 py-2"
        />
        {state.fieldErrors?.text ? <span className="text-xs text-danger">{state.fieldErrors.text}</span> : null}
      </label>
      {state.message ? (
        <p className={`text-sm ${state.status === 'ok' ? 'text-brand-700' : 'text-danger'}`}>{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? copy.sending : copy.send}
      </button>
      <p className="text-xs text-muted">{copy.hint}</p>
    </form>
  );
}
