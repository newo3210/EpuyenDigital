'use client';

import { useActionState } from 'react';
import {
  sendComposerTextAction,
  type ComposerState,
} from '@/features/outbound/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.composer;

type MessageComposerProps = {
  conversationId: string;
};

// MessageComposer - minimal text send; dry_run feedback via action state.
export function MessageComposer({ conversationId }: MessageComposerProps) {
  const [state, formAction, pending] = useActionState<ComposerState, FormData>(
    sendComposerTextAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="sr-only">{copy.label}</span>
        <textarea
          name="text"
          rows={3}
          required
          maxLength={4096}
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
