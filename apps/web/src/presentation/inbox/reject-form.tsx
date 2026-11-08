'use client';

import { useActionState } from 'react';
import { rejectDelegationAction, type InboxActionState } from '@/features/inbox/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox;

type RejectFormProps = {
  conversationId: string;
};

// Reject form - a note is required before the delegation returns to the sender.
export function RejectForm({ conversationId }: RejectFormProps) {
  const [state, action, pending] = useActionState<InboxActionState, FormData>(rejectDelegationAction, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="flex flex-col gap-1">
        {copy.actions.reject}
        <input name="note" required className="rounded border border-line px-2 py-1" placeholder={copy.actions.note} />
      </label>
      {state.status === 'error' ? <p className="text-xs text-danger">{state.message}</p> : null}
      <button disabled={pending} className="self-start rounded border border-line px-3 py-1" type="submit">
        {copy.actions.reject}
      </button>
    </form>
  );
}
