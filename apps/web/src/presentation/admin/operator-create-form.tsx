'use client';

import { startTransition, useActionState } from 'react';
import type { Area } from '@epuyen/shared';
import { OPERATOR_ADMIN_ROLES } from '@/contracts/admin-operators';
import { createOperatorAction, type AdminFormState } from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.settings.operators;
const INITIAL: AdminFormState = {};

// Create-form props - org areas for optional membership checkboxes.
type OperatorCreateFormProps = {
  areas: Area[];
};

// Operator create form - email/name/role/temp password + area checkboxes; shows temp password once.
export function OperatorCreateForm({ areas }: OperatorCreateFormProps) {
  const [state, formAction, pending] = useActionState(createOperatorAction, INITIAL);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-3">
      <label htmlFor="op-email" className="text-sm font-medium">
        {copy.emailLabel}
      </label>
      <input
        id="op-email"
        name="email"
        type="email"
        autoComplete="off"
        required
        aria-invalid={fieldError('email') ? true : undefined}
        className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
      />
      {fieldError('email') && <p className="text-sm text-danger">{fieldError('email')}</p>}

      <label htmlFor="op-name" className="text-sm font-medium">
        {copy.nameLabel}
      </label>
      <input
        id="op-name"
        name="fullName"
        type="text"
        required
        aria-invalid={fieldError('fullName') ? true : undefined}
        className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
      />
      {fieldError('fullName') && <p className="text-sm text-danger">{fieldError('fullName')}</p>}

      <label htmlFor="op-role" className="text-sm font-medium">
        {copy.roleLabel}
      </label>
      <select
        id="op-role"
        name="role"
        defaultValue="operator"
        className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
      >
        {OPERATOR_ADMIN_ROLES.map((role) => (
          <option key={role} value={role}>
            {esAR.roles[role]}
          </option>
        ))}
      </select>

      <label htmlFor="op-password" className="text-sm font-medium">
        {copy.passwordLabel}
      </label>
      <input
        id="op-password"
        name="temporaryPassword"
        type="text"
        autoComplete="new-password"
        required
        minLength={10}
        aria-describedby="op-password-hint"
        aria-invalid={fieldError('temporaryPassword') ? true : undefined}
        className="rounded-lg border border-line bg-surface px-3 py-2 font-mono outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
      />
      <p id="op-password-hint" className="text-xs text-muted">
        {copy.passwordHint}
      </p>
      {fieldError('temporaryPassword') && (
        <p className="text-sm text-danger">{fieldError('temporaryPassword')}</p>
      )}

      {/* Area memberships - optional multi-select via checkboxes. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{copy.areasLabel}</legend>
        {areas.map((area) => (
          <label key={area.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="areaIds" value={area.id} className="size-4 rounded border-line" />
            {area.name}
          </label>
        ))}
      </fieldset>

      {state.status === 'error' && state.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      {/* One-time temp password - shown only after a successful create. */}
      {state.status === 'ok' && state.temporaryPassword && (
        <div role="status" className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm">
          <p className="font-medium text-brand-800">{copy.tempPasswordTitle}</p>
          <p className="mt-1 font-mono text-brand-800">{state.temporaryPassword}</p>
          <p className="mt-1 text-xs text-brand-700">{copy.tempPasswordHint}</p>
        </div>
      )}
      {state.status === 'ok' && state.message && !state.temporaryPassword && (
        <p role="status" className="text-sm text-brand-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-fit items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? copy.saving : copy.create}
      </button>
    </form>
  );
}
