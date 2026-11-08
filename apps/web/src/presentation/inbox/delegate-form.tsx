'use client';

import { useActionState } from 'react';
import type { InboxOption } from '@/contracts/inbox';
import { delegateConversationAction, type InboxActionState } from '@/features/inbox/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox;

type DelegateFormProps = {
  conversationId: string;
  operators: InboxOption[];
  areas: InboxOption[];
};

// Delegate form - one target and a required note. The server action rechecks both.
export function DelegateForm({ conversationId, operators, areas }: DelegateFormProps) {
  const [state, action, pending] = useActionState<InboxActionState, FormData>(delegateConversationAction, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <p className="font-medium">{copy.actions.delegate}</p>
      <label className="flex flex-col gap-1">
        {copy.actions.person}
        <select name="targetUserId" className="rounded border border-line bg-canvas px-2 py-1" defaultValue="">
          <option value="">{copy.filters.all}</option>
          {operators.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        {copy.actions.area}
        <select name="targetAreaId" className="rounded border border-line bg-canvas px-2 py-1" defaultValue="">
          <option value="">{copy.filters.all}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        {copy.actions.note}
        <input name="note" required className="rounded border border-line px-2 py-1" />
      </label>
      {state.message ? <p className="text-xs text-danger">{state.status === 'error' ? state.message : null}</p> : null}
      {state.status === 'ok' ? <p className="text-xs text-brand-700">{state.message}</p> : null}
      <button disabled={pending} className="self-start rounded border border-line px-3 py-1" type="submit">
        {copy.actions.delegate}
      </button>
    </form>
  );
}
