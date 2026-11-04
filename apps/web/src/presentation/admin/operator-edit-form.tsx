'use client';

import { startTransition, useActionState } from 'react';
import type { Area, AreaMembership } from '@epuyen/shared';
import { OPERATOR_ADMIN_ROLES } from '@/contracts/admin-operators';
import {
  assignMembershipAction,
  removeMembershipAction,
  updateOperatorAction,
  type AdminFormState,
} from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.settings.operators;
const INITIAL: AdminFormState = {};

// Edit-form props - operator row, org areas, and current memberships.
type OperatorEditFormProps = {
  operator: {
    id: string;
    fullName: string;
    role: string;
    isActive: boolean;
    email: string | null;
    memberships: AreaMembership[];
  };
  areas: Area[];
};

// Operator edit form - role/active/name plus membership assign/remove controls.
export function OperatorEditForm({ operator, areas }: OperatorEditFormProps) {
  const [state, formAction, pending] = useActionState(updateOperatorAction, INITIAL);
  const [memberState, memberAction, memberPending] = useActionState(assignMembershipAction, INITIAL);
  const [removeState, removeAction, removePending] = useActionState(removeMembershipAction, INITIAL);

  const memberAreaIds = new Set(operator.memberships.map((m) => m.areaId));
  const availableAreas = areas.filter((area) => !memberAreaIds.has(area.id));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Checkbox omit - unchecked boxes are absent from FormData; force an explicit boolean.
    formData.set('isActive', formData.get('isActive') === 'true' ? 'true' : 'false');
    startTransition(() => formAction(formData));
  };

  const onAssign = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('userId', operator.id);
    startTransition(() => memberAction(formData));
  };

  const onRemove = (areaId: string) => {
    const formData = new FormData();
    formData.set('areaId', areaId);
    formData.set('userId', operator.id);
    startTransition(() => removeAction(formData));
  };

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-3">
        <input type="hidden" name="userId" value={operator.id} />

        {operator.email && (
          <p className="text-sm text-muted">
            {copy.emailLabel}: <span className="text-ink">{operator.email}</span>
          </p>
        )}

        <label htmlFor="edit-name" className="text-sm font-medium">
          {copy.nameLabel}
        </label>
        <input
          id="edit-name"
          name="fullName"
          type="text"
          defaultValue={operator.fullName}
          className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
        />

        <label htmlFor="edit-role" className="text-sm font-medium">
          {copy.roleLabel}
        </label>
        <select
          id="edit-role"
          name="role"
          defaultValue={OPERATOR_ADMIN_ROLES.includes(operator.role as (typeof OPERATOR_ADMIN_ROLES)[number])
            ? operator.role
            : 'operator'}
          className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          {OPERATOR_ADMIN_ROLES.map((role) => (
            <option key={role} value={role}>
              {esAR.roles[role]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={operator.isActive}
            className="size-4 rounded border-line"
          />
          {copy.activeLabel}
        </label>

        {state.status === 'error' && state.message && (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )}
        {state.status === 'ok' && state.message && (
          <p role="status" className="text-sm text-brand-700">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {pending ? copy.saving : copy.save}
        </button>
      </form>

      {/* Memberships - current list with remove + assign form for remaining areas. */}
      <section aria-labelledby="memberships-heading" className="flex max-w-lg flex-col gap-3">
        <h2 id="memberships-heading" className="text-lg font-semibold">
          {copy.membershipsTitle}
        </h2>

        <ul className="divide-y divide-line rounded-lg border border-line">
          {operator.memberships.map((membership) => {
            const area = areas.find((item) => item.id === membership.areaId);
            return (
              <li key={`${membership.areaId}-${membership.userId}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm">
                  {area?.name ?? membership.areaId}
                  {membership.isLead ? ` · ${copy.leadLabel}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(membership.areaId)}
                  disabled={removePending}
                  className="text-sm font-medium text-danger hover:underline disabled:opacity-60"
                >
                  {copy.removeMembership}
                </button>
              </li>
            );
          })}
          {operator.memberships.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{esAR.settings.areas.empty}</li>
          )}
        </ul>

        {availableAreas.length > 0 && (
          <form onSubmit={onAssign} className="flex flex-col gap-2 border-t border-line pt-3">
            <label htmlFor="assign-area" className="text-sm font-medium">
              {copy.addMembership}
            </label>
            <select
              id="assign-area"
              name="areaId"
              required
              className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              {availableAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isLead" value="true" className="size-4 rounded border-line" />
              {copy.leadLabel}
            </label>
            {(memberState.status === 'error' || removeState.status === 'error') && (
              <p role="alert" className="text-sm text-danger">
                {memberState.message ?? removeState.message}
              </p>
            )}
            <button
              type="submit"
              disabled={memberPending}
              className="inline-flex w-fit items-center rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-60"
            >
              {memberPending ? copy.saving : copy.addMembership}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
