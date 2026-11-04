import type { AreaMembership, Profile } from '@epuyen/shared';
import { assignMembershipSchema } from '@/contracts/admin-areas';
import { requireRole } from '@/features/auth/require-role';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// Assign-membership ports - upsert area_members row.
export type AssignMembershipDeps = {
  actor: Profile;
  forbidden: () => never;
  upsertMembership: (input: {
    areaId: string;
    userId: string;
    isLead: boolean;
  }) => Promise<AreaMembership>;
};

export type AssignMembershipResult =
  | { status: 'ok'; membership: AreaMembership }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'failed'; message: string };

// Assign-membership use case - admin links an operator to an area.
export async function assignMembership(
  input: unknown,
  deps: AssignMembershipDeps,
): Promise<AssignMembershipResult> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const parsed = assignMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'invalid', fieldErrors: { areaId: esAR.settings.operators.errors.saveFailed } };
  }

  try {
    const membership = await deps.upsertMembership({
      areaId: parsed.data.areaId,
      userId: parsed.data.userId,
      isLead: parsed.data.isLead,
    });
    return { status: 'ok', membership };
  } catch (error) {
    const mapped = mapAdminWriteError(error, esAR.settings.operators.errors.saveFailed);
    return { status: 'failed', message: mapped.message };
  }
}
