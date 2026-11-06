'use client';

import { startTransition, useActionState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { areaCreateSchema, type Area, type AreaCreateInput } from '@/contracts/areas';
import { createAreaAction, updateAreaAction, type AreaFormState } from '@/features/areas/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.areas;
const INITIAL_STATE: AreaFormState = {};

// Form props - optional existing area switches create vs update action.
type AreaFormProps = {
  area?: Area;
};

// Area form - admin create/edit for municipal areas (thin: validation + server action only).
export function AreaForm({ area }: AreaFormProps) {
  const action = area ? updateAreaAction : createAreaAction;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AreaCreateInput>({
    resolver: zodResolver(areaCreateSchema) as Resolver<AreaCreateInput>,
    defaultValues: {
      name: area?.name ?? '',
      description: area?.description ?? '',
      color: area?.color ?? '#1B4F72',
      isActive: area?.isActive ?? true,
      isDefault: area?.isDefault ?? false,
      slaWarningMinutes: area?.slaWarningMinutes ?? undefined,
      slaCriticalMinutes: area?.slaCriticalMinutes ?? undefined,
    },
  });

  // Submit handler - only schema-valid payloads reach the server action.
  const onValid = (values: AreaCreateInput) => {
    const formData = new FormData();
    if (area) formData.set('id', area.id);
    formData.set('name', values.name);
    if (values.description) formData.set('description', values.description);
    formData.set('color', values.color);
    if (values.isActive) formData.set('isActive', 'true');
    if (values.isDefault) formData.set('isDefault', 'true');
    if (values.slaWarningMinutes !== undefined) formData.set('slaWarningMinutes', String(values.slaWarningMinutes));
    if (values.slaCriticalMinutes !== undefined) formData.set('slaCriticalMinutes', String(values.slaCriticalMinutes));
    startTransition(() => formAction(formData));
  };

  const fieldError = (key: keyof AreaCreateInput) => errors[key]?.message ?? state.fieldErrors?.[key];

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{area ? copy.edit : copy.create}</h2>

      {area && <input type="hidden" name="id" value={area.id} />}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.fields.name}
        <input
          className="rounded-lg border border-line bg-surface px-3 py-2"
          aria-invalid={fieldError('name') ? true : undefined}
          {...register('name')}
        />
        {fieldError('name') && <span className="font-normal text-danger">{fieldError('name')}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.fields.description}
        <textarea className="rounded-lg border border-line bg-surface px-3 py-2" rows={2} {...register('description')} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.fields.color}
        <input
          type="text"
          className="rounded-lg border border-line bg-surface px-3 py-2 font-mono"
          aria-invalid={fieldError('color') ? true : undefined}
          {...register('color')}
        />
        {fieldError('color') && <span className="font-normal text-danger">{fieldError('color')}</span>}
      </label>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" {...register('isActive')} />
          {copy.fields.isActive}
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" {...register('isDefault')} />
          {copy.fields.isDefault}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {copy.fields.slaWarning}
          <input
            type="number"
            min={1}
            className="rounded-lg border border-line bg-surface px-3 py-2"
            {...register('slaWarningMinutes')}
          />
          {fieldError('slaWarningMinutes') && (
            <span className="font-normal text-danger">{fieldError('slaWarningMinutes')}</span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {copy.fields.slaCritical}
          <input
            type="number"
            min={1}
            className="rounded-lg border border-line bg-surface px-3 py-2"
            {...register('slaCriticalMinutes')}
          />
          {fieldError('slaCriticalMinutes') && (
            <span className="font-normal text-danger">{fieldError('slaCriticalMinutes')}</span>
          )}
        </label>
      </div>

      {state.status === 'ok' && (
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
