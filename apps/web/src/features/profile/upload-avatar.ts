import { AVATAR_MAX_BYTES } from '@/contracts/profile';
import { esAR } from '@/i18n/es-AR';
import { sniffImage } from './sniff-image';

// Upload input - raw file content and its byte size.
export type AvatarUpload = { bytes: Uint8Array; size: number };

// Upload ports - owner identity, current avatar, id factory, storage and profile writers.
export type UploadAvatarDeps = {
  orgId: string;
  userId: string;
  previousPath: string | null;
  generateId: () => string;
  uploadObject: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  saveAvatarPath: (userId: string, path: string) => Promise<void>;
  removeObject: (path: string) => Promise<void>;
};

// Upload outcome - stored path, user-facing validation error, or generic failure.
export type UploadAvatarResult =
  | { status: 'ok'; path: string }
  | { status: 'invalid'; message: string }
  | { status: 'failed'; message: string };

const copy = esAR.profile.errors;

// Upload use case - validate size + magic bytes, store, link to profile, then drop the old object.
export async function uploadAvatar(file: AvatarUpload, deps: UploadAvatarDeps): Promise<UploadAvatarResult> {
  const image = file.size > 0 && file.size <= AVATAR_MAX_BYTES ? sniffImage(file.bytes) : null;
  if (!image) return { status: 'invalid', message: copy.invalidImage };

  const path = `${deps.orgId}/${deps.userId}/${deps.generateId()}.${image.ext}`;
  try {
    await deps.uploadObject(path, file.bytes, image.mime);
  } catch {
    return { status: 'failed', message: copy.saveFailed };
  }

  try {
    await deps.saveAvatarPath(deps.userId, path);
  } catch {
    await deps.removeObject(path).catch(() => undefined);
    return { status: 'failed', message: copy.saveFailed };
  }

  if (deps.previousPath && deps.previousPath !== path) {
    await deps.removeObject(deps.previousPath).catch(() => undefined);
  }
  return { status: 'ok', path };
}
