'use client';

import { useActionState, useState } from 'react';
import {
  sendComposerTextAction,
  type ComposerState,
} from '@/features/outbound/actions';
import type { QuickReply } from '@/contracts/inbox';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.composer;
const quickCopy = esAR.inbox.quickReplies;

type MessageComposerProps = {
  conversationId: string;
  quickReplies?: QuickReply[];
};

// MessageComposer - text send + quick-reply insert; conflict toasts via action state.
export function MessageComposer({ conversationId, quickReplies = [] }: MessageComposerProps) {
  const [state, formAction, pending] = useActionState<ComposerState, FormData>(
    sendComposerTextAction,
    {},
  );
  const [text, setText] = useState('');

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="conversationId" value={conversationId} />

      {quickReplies.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {quickCopy.title}
          </p>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply.id}
                type="button"
                onClick={() => setText(reply.body)}
                className="rounded-md border border-line px-2 py-1 text-xs hover:bg-canvas"
                title={reply.shortcut}
              >
                {reply.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">{quickCopy.empty}</p>
      )}

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
        {state.fieldErrors?.text ? (
          <span className="text-xs text-danger">{state.fieldErrors.text}</span>
        ) : null}
      </label>
      {state.message ? (
        <p className={`text-sm ${state.status === 'ok' ? 'text-brand-700' : 'text-danger'}`}>
          {state.message}
        </p>
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
