'use client';

import { startTransition, useActionState, type FormEvent } from 'react';
import type { ErrorStatus } from '@epuyen/shared';
import { changeErrorStatusAction, type ErrorStatusFormState } from '@/features/errors/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.support.errors.actions;
const INITIAL_STATE: ErrorStatusFormState = {};

// Transition table - target statuses offered from each current status, with their button label.
const TRANSITIONS: Record<ErrorStatus, { target: ErrorStatus; label: string }[]> = {
  open: [
    { target: 'acknowledged', label: copy.acknowledge },
    { target: 'resolved', label: copy.resolve },
  ],
  acknowledged: [
    { target: 'resolved', label: copy.resolve },
    { target: 'open', label: copy.reopen },
  ],
  resolved: [{ target: 'open', label: copy.reopen }],
};

// Actions props - incident id and its current status.
type ErrorStatusActionsProps = {
  id: string;
  status: ErrorStatus;
};

// Status actions - one button per allowed transition, submitted through the change-status action.
export function ErrorStatusActions({ id, status }: ErrorStatusActionsProps) {
  const [state, formAction, pending] = useActionState(changeErrorStatusAction, INITIAL_STATE);

  // Submit handler - sends the incident id with the clicked target status.
  const submit = (target: ErrorStatus) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set('id', id);
    formData.set('status', target);
    startTransition(() => formAction(formData));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {TRANSITIONS[status].map(({ target, label }) => (
          <form key={target} onSubmit={submit(target)}>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
            >
              {label}
            </button>
          </form>
        ))}
      </div>
      {pending && <p className="text-sm text-muted">{copy.saving}</p>}
      {state.status === 'error' && state.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}
