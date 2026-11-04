import type { Profile, Role } from '@epuyen/shared';
import { updateOperatorSchema } from '@/contracts/admin-operators';
import { requireRole } from '@/features/auth/require-role';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// Update-operator ports - privileged profile writer (RLS admin or service role).
export type UpdateOperatorDeps = {
  actor: Profile;
  forbidden: () => never;
  updateProfile: (input: {
    userId: string;
    role?: Role;
    isActive?: boolean;
    fullName?: string;
  }) => Promise<void>;
};

// Update-operator outcome - includes last_admin mapping from Postgres.
export type UpdateOperatorResult =
  | { status: 'ok' }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'last_admin'; message: string }
  | { status: 'failed'; message: string };

// Update-operator use case - admin changes role / active / name; last admin blocked in SQL.
export async function updateOperator(input: unknown, deps: UpdateOperatorDeps): Promise<UpdateOperatorResult> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const parsed = updateOperatorSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const mapped: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) mapped[key] = messages[0];
    }
    return { status: 'invalid', fieldErrors: mapped };
  }

  const { userId, role, isActive, fullName } = parsed.data;
  if (role === undefined && isActive === undefined && fullName === undefined) {
    return { status: 'invalid', fieldErrors: { userId: esAR.settings.operators.errors.saveFailed } };
  }

  try {
    await deps.updateProfile({ userId, role, isActive, fullName });
    return { status: 'ok' };
  } catch (error) {
    const mapped = mapAdminWriteError(error, esAR.settings.operators.errors.saveFailed);
    if (mapped.status === 'last_admin') return mapped;
    return { status: 'failed', message: mapped.message };
  }
}
