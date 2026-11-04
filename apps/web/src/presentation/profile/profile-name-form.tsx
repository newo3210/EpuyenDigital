'use client';

import { startTransition, useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileNameSchema, type ProfileNameInput } from '@/contracts/profile';
import { updateNameAction, type ProfileFormState } from '@/features/profile/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.profile;
const INITIAL_STATE: ProfileFormState = {};

// Form props - current display name used as the initial value.
type ProfileNameFormProps = {
  fullName: string;
};

// Profile name form - 2-80 chars validated client-side, saved by the update-name action.
export function ProfileNameForm({ fullName }: ProfileNameFormProps) {
  const [state, formAction, pending] = useActionState(updateNameAction, INITIAL_STATE);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileNameInput>({ resolver: zodResolver(profileNameSchema), defaultValues: { fullName } });

  // Submit handler - only valid names reach the server action.
  const onValid = (values: ProfileNameInput) => {
    const formData = new FormData();
    formData.set('fullName', values.fullName);
    startTransition(() => formAction(formData));
  };

  const fieldError = errors.fullName?.message ?? state.fieldErrors?.fullName;

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="flex flex-col gap-3">
      <label htmlFor="profile-full-name" className="text-sm font-medium">
        {copy.nameLabel}
      </label>
      <input
        id="profile-full-name"
        type="text"
        autoComplete="name"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? 'profile-full-name-error' : undefined}
        className="w-full max-w-md rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 aria-invalid:border-danger"
        {...register('fullName')}
      />
      {fieldError && (
        <p id="profile-full-name-error" className="text-sm text-danger">
          {fieldError}
        </p>
      )}

      {/* Outcome - server confirmation or failure message. */}
      {state.status === 'ok' && !fieldError && (
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
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          {pending ? copy.savingName : copy.saveName}
        </button>
      </div>
    </form>
  );
}
