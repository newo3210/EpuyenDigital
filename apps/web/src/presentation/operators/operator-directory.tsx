'use client';

import { startTransition, useActionState } from 'react';
import type { Area } from '@/contracts/areas';
import type { OperatorDirectoryEntry } from '@/contracts/operators';
import { deactivateOperatorAction, type OperatorFormState } from '@/features/operators/actions';
import { esAR } from '@/i18n/es-AR';
import { OperatorForm } from './operator-form';

const copy = esAR.operators;
const INITIAL_STATE: OperatorFormState = {};

// Directory props - operators and areas loaded by the page.
type OperatorDirectoryProps = {
  operators: OperatorDirectoryEntry[];
  areas: Area[];
};

// Soft activate/deactivate control - thin wrapper around the deactivate action.
function ActiveToggle({ operator }: { operator: OperatorDirectoryEntry }) {
  const [state, formAction, pending] = useActionState(deactivateOperatorAction, INITIAL_STATE);

  const onToggle = () => {
    const formData = new FormData();
    formData.set('id', operator.id);
    formData.set('isActive', operator.isActive ? 'false' : 'true');
    startTransition(() => formAction(formData));
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-canvas disabled:opacity-60"
      >
        {operator.isActive ? copy.deactivate : copy.reactivate}
      </button>
      {state.status === 'error' && state.message && (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}

// Operator directory - create form, table summary, per-row edit + deactivate.
export function OperatorDirectory({ operators, areas }: OperatorDirectoryProps) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="operators-create-heading" className="rounded-xl border border-line bg-surface p-6">
        <h2 id="operators-create-heading" className="sr-only">
          {copy.create}
        </h2>
        <OperatorForm areas={areas} />
      </section>

      <section aria-labelledby="operators-list-heading" className="flex flex-col gap-4">
        <h2 id="operators-list-heading" className="text-lg font-semibold">
          {copy.title}
        </h2>
        {operators.length === 0 ? (
          <p className="text-sm text-muted">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {operators.map((operator) => (
              <li key={operator.id} className="rounded-xl border border-line bg-surface p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="text-base font-semibold">{operator.fullName}</span>
                    <span className="text-muted">{operator.email ?? '—'}</span>
                    <span>
                      {esAR.roles[operator.role]} ·{' '}
                      {operator.isActive ? copy.status.active : copy.status.inactive}
                    </span>
                    <span className="text-muted">
                      {copy.columns.areas}:{' '}
                      {operator.memberships.length > 0
                        ? operator.memberships.map((m) => m.areaName).join(', ')
                        : '—'}
                    </span>
                  </div>
                  <ActiveToggle operator={operator} />
                </div>
                <OperatorForm areas={areas} operator={operator} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
