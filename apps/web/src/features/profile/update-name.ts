import { profileNameSchema } from '@/contracts/profile';
import { esAR } from '@/i18n/es-AR';

// Update-name ports - signed-in user id and the profile name writer (RLS: own row).
export type UpdateNameDeps = {
  userId: string;
  saveName: (userId: string, fullName: string) => Promise<void>;
};

// Update-name outcome - saved name, field error, or generic failure.
export type UpdateNameResult =
  | { status: 'ok'; fullName: string }
  | { status: 'invalid'; fieldErrors: { fullName: string } }
  | { status: 'failed'; message: string };

// Update-name use case - validates and trims, then persists the display name.
export async function updateName(input: unknown, deps: UpdateNameDeps): Promise<UpdateNameResult> {
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.flatten().fieldErrors.fullName?.[0] ?? esAR.profile.errors.nameLength;
    return { status: 'invalid', fieldErrors: { fullName: message } };
  }

  try {
    await deps.saveName(deps.userId, parsed.data.fullName);
  } catch {
    return { status: 'failed', message: esAR.profile.errors.saveFailed };
  }
  return { status: 'ok', fullName: parsed.data.fullName };
}
