import type { Profile, Role } from '@epuyen/shared';
import { createOperatorSchema } from '@/contracts/admin-operators';
import { requireRole } from '@/features/auth/require-role';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// Create-operator ports - auth user factory, profile insert, optional memberships.
export type CreateOperatorDeps = {
  actor: Profile;
  forbidden: () => never;
  createAuthUser: (input: {
    email: string;
    password: string;
  }) => Promise<{ id: string }>;
  insertProfile: (input: {
    id: string;
    orgId: string;
    fullName: string;
    role: Role;
  }) => Promise<void>;
  assignMemberships: (userId: string, areaIds: string[]) => Promise<void>;
};

// Create-operator outcome - temp password returned once on success.
export type CreateOperatorResult =
  | { status: 'ok'; userId: string; temporaryPassword: string }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'duplicate'; message: string }
  | { status: 'failed'; message: string };

// Create-operator use case - admin only; auth user + profile + memberships.
export async function createOperator(input: unknown, deps: CreateOperatorDeps): Promise<CreateOperatorResult> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const parsed = createOperatorSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const mapped: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) mapped[key] = messages[0];
    }
    return { status: 'invalid', fieldErrors: mapped };
  }

  const { email, fullName, role, temporaryPassword, areaIds } = parsed.data;

  try {
    const user = await deps.createAuthUser({ email, password: temporaryPassword });
    await deps.insertProfile({
      id: user.id,
      orgId: deps.actor.orgId,
      fullName,
      role,
    });
    if (areaIds.length > 0) await deps.assignMemberships(user.id, areaIds);
    return { status: 'ok', userId: user.id, temporaryPassword };
  } catch (error) {
    const mapped = mapAdminWriteError(error, esAR.settings.operators.errors.saveFailed);
    if (mapped.status === 'duplicate') return mapped;
    return { status: 'failed', message: mapped.message };
  }
}
