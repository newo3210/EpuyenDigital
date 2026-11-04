'use server';

import { revalidatePath } from 'next/cache';
import { AVATAR_MAX_BYTES } from '@/contracts/profile';
import { getCurrentOperator } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { updateProfileAvatarPath, updateProfileName } from '@/infrastructure/repositories/profiles';
import { removeAvatarObject, uploadAvatarObject } from '@/infrastructure/storage/avatars';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { updateName } from './update-name';
import { uploadAvatar } from './upload-avatar';

// Profile form state - outcome message plus optional field error (useActionState).
export type ProfileFormState = {
  status?: 'ok' | 'error';
  message?: string;
  fieldErrors?: { fullName?: string };
};

// Update-name action - own row via the user-scoped client; layout revalidated so the top bar updates.
export async function updateNameAction(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const operator = await getCurrentOperator();
  const supabase = await createServerSupabase();
  const fullName = formData.get('fullName');

  const result = await updateName(
    { fullName: typeof fullName === 'string' ? fullName : undefined },
    { userId: operator.id, saveName: (userId, name) => updateProfileName(supabase, userId, name) },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/', 'layout');
  return { status: 'ok', message: esAR.profile.nameSaved };
}

// Upload-avatar action - re-validates on the server (size + magic bytes) before touching storage.
export async function uploadAvatarAction(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const operator = await getCurrentOperator();
  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: esAR.profile.errors.fileRequired };
  }

  const supabase = await createServerSupabase();
  const bytes = file.size <= AVATAR_MAX_BYTES ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array(0);
  const result = await uploadAvatar(
    { bytes, size: file.size },
    {
      orgId: operator.orgId,
      userId: operator.id,
      previousPath: operator.avatarPath,
      generateId: () => crypto.randomUUID(),
      uploadObject: (path, content, contentType) => uploadAvatarObject(supabase, path, content, contentType),
      saveAvatarPath: (userId, path) => updateProfileAvatarPath(supabase, userId, path),
      removeObject: (path) => removeAvatarObject(supabase, path),
    },
  );

  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath('/', 'layout');
  return { status: 'ok', message: esAR.profile.avatarSaved };
}
