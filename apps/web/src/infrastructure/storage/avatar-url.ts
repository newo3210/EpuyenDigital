import { readPublicEnv } from '@/infrastructure/env';

// Bucket name - public avatars bucket created by the foundation migration.
export const AVATARS_BUCKET = 'avatars';

// Public avatar URL - object URL for a stored avatar path (segments encoded), null when the operator has none.
export function avatarPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const { NEXT_PUBLIC_SUPABASE_URL } = readPublicEnv();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATARS_BUCKET}/${encodedPath}`;
}
