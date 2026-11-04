'use client';

import { startTransition, useActionState } from 'react';
import type { Area } from '@epuyen/shared';
import {
  createAreaAction,
  setDefaultAreaAction,
  updateAreaAction,
  type AdminFormState,
} from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.settings.areas;
const INITIAL: AdminFormState = {};

// Area form props - optional existing area for edit mode.
type AreaFormProps = {
  area?: Area;
};

// Area form - create or update name/description/color/active; set-default is a separate control.
export function AreaForm({ area }: AreaFormProps) {
  const action = area ? updateAreaAction : createAreaAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [defaultState, defaultAction, defaultPending] = useActionState(setDefaultAreaAction, INITIAL);

  // Submit handler - posts the form fields to the matching server action.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Checkbox omit - unchecked boxes are absent from FormData; force an explicit boolean.
    formData.set('isActive', formData.get('isActive') === 'true' ? 'true' : 'false');
    startTransition(() => formAction(formData));
  };

  // Default handler - marks this area as Mesa de Entrada via RPC.
  const onSetDefault = () => {
    if (!area) return;
    const formData = new FormData();
    formData.set('areaId', area.id);
    startTransition(() => defaultAction(formData));
  };

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-3">
        {area && <input type="hidden" name="id" value={area.id} />}

        <label htmlFor="area-name" className="text-sm font-medium">
          {copy.nameLabel}
        </label>
        <input
          id="area-name"
          name="name"
          type="text"
          required
          defaultValue={area?.name ?? ''}
          aria-invalid={fieldError('name') ? true : undefined}
          className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
        />
        {fieldError('name') && <p className="text-sm text-danger">{fieldError('name')}</p>}

        <label htmlFor="area-description" className="text-sm font-medium">
          {copy.descriptionLabel}
        </label>
        <textarea
          id="area-description"
          name="description"
          rows={3}
          defaultValue={area?.description ?? ''}
          className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
        />

        <label htmlFor="area-color" className="text-sm font-medium">
          {copy.colorLabel}
        </label>
        <input
          id="area-color"
          name="color"
          type="text"
          placeholder="#1f6f5c"
          defaultValue={area?.color ?? ''}
          aria-invalid={fieldError('color') ? true : undefined}
          className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
        />
        {fieldError('color') && <p className="text-sm text-danger">{fieldError('color')}</p>}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={area?.isActive ?? true}
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

      {/* Default control - only on edit when the area is not already default. */}
      {area && !area.isDefault && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          {defaultState.status === 'error' && defaultState.message && (
            <p role="alert" className="text-sm text-danger">
              {defaultState.message}
            </p>
          )}
          {defaultState.status === 'ok' && defaultState.message && (
            <p role="status" className="text-sm text-brand-700">
              {defaultState.message}
            </p>
          )}
          <button
            type="button"
            onClick={onSetDefault}
            disabled={defaultPending}
            className="inline-flex w-fit items-center rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas disabled:opacity-60"
          >
            {defaultPending ? copy.settingDefault : copy.setDefault}
          </button>
        </div>
      )}
    </div>
  );
}
