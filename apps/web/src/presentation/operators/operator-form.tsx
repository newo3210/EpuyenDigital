'use client';

import { startTransition, useActionState, type FormEvent } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROLES } from '@epuyen/shared';
import type { Area } from '@/contracts/areas';
import {
  operatorCreateSchema,
  type OperatorCreateInput,
  type OperatorDirectoryEntry,
} from '@/contracts/operators';
import {
  createOperatorAction,
  updateOperatorAction,
  type OperatorFormState,
} from '@/features/operators/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.operators;
const INITIAL_STATE: OperatorFormState = {};

// Form props - areas for membership checkboxes; optional operator switches create vs edit.
type OperatorFormProps = {
  areas: Area[];
  operator?: OperatorDirectoryEntry;
};

// Form values - create schema shape; edit mode ignores email/password fields.
type OperatorFormValues = OperatorCreateInput;

// Operator form - create shows temp password once; edit changes role/memberships only.
export function OperatorForm({ areas, operator }: OperatorFormProps) {
  const isEdit = Boolean(operator);
  const action = isEdit ? updateOperatorAction : createOperatorAction;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OperatorFormValues>({
    resolver: isEdit ? undefined : (zodResolver(operatorCreateSchema) as Resolver<OperatorFormValues>),
    defaultValues: {
      email: operator?.email ?? '',
      fullName: operator?.fullName ?? '',
      role: operator?.role ?? 'operator',
      temporaryPassword: '',
      memberships: operator?.memberships.map((m) => ({ areaId: m.areaId, isLead: m.isLead })) ?? [],
    },
  });

  const selected = new Set((watch('memberships') ?? []).map((m) => m.areaId));
  const leadSelected = new Set((watch('memberships') ?? []).filter((m) => m.isLead).map((m) => m.areaId));

  // Membership toggle - keep memberships array in sync with checkboxes.
  const toggleArea = (areaId: string, checked: boolean) => {
    const current = watch('memberships') ?? [];
    if (checked) {
      setValue('memberships', [...current.filter((m) => m.areaId !== areaId), { areaId, isLead: false }]);
    } else {
      setValue(
        'memberships',
        current.filter((m) => m.areaId !== areaId),
      );
    }
  };

  const toggleLead = (areaId: string, checked: boolean) => {
    const current = watch('memberships') ?? [];
    setValue(
      'memberships',
      current.map((m) => (m.areaId === areaId ? { ...m, isLead: checked } : m)),
    );
  };

  // Submit handler - builds FormData for the matching server action.
  const onValid = (values: OperatorFormValues) => {
    const formData = new FormData();
    if (operator) formData.set('id', operator.id);
    if (!isEdit) {
      formData.set('email', values.email);
      formData.set('fullName', values.fullName);
      formData.set('temporaryPassword', values.temporaryPassword);
    }
    formData.set('role', values.role);
    for (const membership of values.memberships ?? []) {
      formData.append('areaId', membership.areaId);
      if (membership.isLead) formData.append('isLead', membership.areaId);
    }
    startTransition(() => formAction(formData));
  };

  const onSubmit = isEdit
    ? (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        // Rebuild memberships from checked boxes in the DOM for edit mode (no create schema).
        const memberships = areas
          .filter((area) => selected.has(area.id))
          .map((area) => ({ areaId: area.id, isLead: leadSelected.has(area.id) }));
        formData.delete('areaId');
        formData.delete('isLead');
        for (const membership of memberships) {
          formData.append('areaId', membership.areaId);
          if (membership.isLead) formData.append('isLead', membership.areaId);
        }
        startTransition(() => formAction(formData));
      }
    : handleSubmit(onValid);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{isEdit ? copy.edit : copy.create}</h2>

      {operator && <input type="hidden" name="id" value={operator.id} />}

      {!isEdit && (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {copy.fields.email}
            <input
              type="email"
              className="rounded-lg border border-line bg-surface px-3 py-2"
              {...register('email')}
            />
            {(errors.email?.message || state.fieldErrors?.email) && (
              <span className="font-normal text-danger">{errors.email?.message ?? state.fieldErrors?.email}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {copy.fields.fullName}
            <input className="rounded-lg border border-line bg-surface px-3 py-2" {...register('fullName')} />
            {(errors.fullName?.message || state.fieldErrors?.fullName) && (
              <span className="font-normal text-danger">
                {errors.fullName?.message ?? state.fieldErrors?.fullName}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            {copy.fields.temporaryPassword}
            <input
              type="text"
              autoComplete="new-password"
              className="rounded-lg border border-line bg-surface px-3 py-2 font-mono"
              {...register('temporaryPassword')}
            />
            {(errors.temporaryPassword?.message || state.fieldErrors?.temporaryPassword) && (
              <span className="font-normal text-danger">
                {errors.temporaryPassword?.message ?? state.fieldErrors?.temporaryPassword}
              </span>
            )}
          </label>
        </>
      )}

      {isEdit && (
        <p className="text-sm text-muted">
          {operator?.email} · {operator?.fullName}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.fields.role}
        <select className="rounded-lg border border-line bg-surface px-3 py-2" {...register('role')}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {esAR.roles[role]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{copy.fields.memberships}</legend>
        {areas.map((area) => (
          <div key={area.id} className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(area.id)}
                onChange={(event) => toggleArea(area.id, event.target.checked)}
              />
              {area.name}
            </label>
            {selected.has(area.id) && (
              <label className="inline-flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={leadSelected.has(area.id)}
                  onChange={(event) => toggleLead(area.id, event.target.checked)}
                />
                {copy.fields.isLead}
              </label>
            )}
          </div>
        ))}
      </fieldset>

      {state.status === 'ok' && state.temporaryPassword && (
        <div role="status" className="rounded-lg border border-brand-600/30 bg-brand-50 p-3 text-sm">
          <p className="font-medium text-brand-800">{state.message}</p>
          <p className="mt-2 font-mono text-brand-900">
            {copy.tempPasswordLabel}: {state.temporaryPassword}
          </p>
        </div>
      )}
      {state.status === 'ok' && !state.temporaryPassword && (
        <p role="status" className="text-sm text-brand-700">
          {state.message}
        </p>
      )}
      {state.status === 'error' && state.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? copy.saving : copy.save}
        </button>
      </div>
    </form>
  );
}
