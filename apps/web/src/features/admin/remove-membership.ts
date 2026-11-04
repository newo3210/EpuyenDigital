import type { Profile } from '@epuyen/shared';
import { removeMembershipSchema } from '@/contracts/admin-areas';
import { requireRole } from '@/features/auth/require-role';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// Remove-membership ports - delete area_members row.
export type RemoveMembershipDeps = {
  actor: Profile;
  forbidden: () => never;
  deleteMembership: (areaId: string, userId: string) => Promise<void>;
};

export type RemoveMembershipResult =
  | { status: 'ok' }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'failed'; message: string };

// Remove-membership use case - admin unlinks an operator from an area.
export async function removeMembership(
  input: unknown,
  deps: RemoveMembershipDeps,
): Promise<RemoveMembershipResult> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const parsed = removeMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'invalid', fieldErrors: { areaId: esAR.settings.operators.errors.saveFailed } };
  }

  try {
    await deps.deleteMembership(parsed.data.areaId, parsed.data.userId);
    return { status: 'ok' };
  } catch (error) {
    const mapped = mapAdminWriteError(error, esAR.settings.operators.errors.saveFailed);
    return { status: 'failed', message: mapped.message };
  }
}
