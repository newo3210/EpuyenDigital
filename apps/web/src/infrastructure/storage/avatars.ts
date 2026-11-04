import { RepositoryError, type DbClient } from '@/infrastructure/repositories/errors';
import { AVATARS_BUCKET } from './avatar-url';

// Avatar upload - user-scoped client so the storage policy enforces avatars/{org}/{user}/.
export async function uploadAvatarObject(
  client: DbClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await client.storage.from(AVATARS_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new RepositoryError('storage.write_failed', error.message);
}

// Avatar removal - deletes a single object (previous avatar or rollback of a failed link).
export async function removeAvatarObject(client: DbClient, path: string): Promise<void> {
  const { error } = await client.storage.from(AVATARS_BUCKET).remove([path]);
  if (error) throw new RepositoryError('storage.remove_failed', error.message);
}
