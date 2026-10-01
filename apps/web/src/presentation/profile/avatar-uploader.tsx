'use client';

import { startTransition, useActionState, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { avatarFileSchema } from '@/contracts/profile';
import { uploadAvatarAction, type ProfileFormState } from '@/features/profile/actions';
import { esAR } from '@/i18n/es-AR';
import { Avatar } from '@/presentation/ui/avatar';

const copy = esAR.profile;
const INITIAL_STATE: ProfileFormState = {};

// Uploader props - identity for the current avatar preview.
type AvatarUploaderProps = {
  fullName: string;
  avatarUrl: string | null;
};

// Avatar uploader - client pre-check (type/size) for fast feedback; the server re-validates by content.
export function AvatarUploader({ fullName, avatarUrl }: AvatarUploaderProps) {
  const [state, formAction, pending] = useActionState(uploadAvatarAction, INITIAL_STATE);
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // File selection - validate declared type and size as soon as a file is picked.
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    setFile(picked);
    setClientError(picked && !avatarFileSchema.safeParse(picked).success ? copy.errors.invalidImage : null);
  };

  // Submit handler - blocks invalid or missing files, otherwise sends the file to the action.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return setClientError(copy.errors.fileRequired);
    if (!avatarFileSchema.safeParse(file).success) return setClientError(copy.errors.invalidImage);

    const formData = new FormData();
    formData.set('avatar', file);
    startTransition(() => formAction(formData));
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const error = clientError ?? (state.status === 'error' ? state.message : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar fullName={fullName} src={avatarUrl} size="lg" />

      {/* File picker - accepted types hint, outcome messages and submit. */}
      <div className="flex flex-col gap-2">
        <label htmlFor="profile-avatar" className="text-sm font-medium">
          {copy.avatarLabel}
        </label>
        <input
          id="profile-avatar"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="profile-avatar-hint"
          onChange={handleChange}
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm"
        />
        <p id="profile-avatar-hint" className="text-xs text-muted">
          {copy.avatarHint}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!error && state.status === 'ok' && (
          <p role="status" className="text-sm text-brand-700">
            {state.message}
          </p>
        )}
        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            {pending ? copy.uploadingAvatar : copy.uploadAvatar}
          </button>
        </div>
      </div>
    </form>
  );
}
