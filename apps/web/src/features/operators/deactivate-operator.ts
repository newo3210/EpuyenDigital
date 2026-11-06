import type { Role } from '@epuyen/shared';
import { operatorDeactivateSchema } from '@/contracts/operators';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.operators.errors;

// Deactivate-operator ports - active flag writer plus last-admin preflight.
export type DeactivateOperatorDeps = {
  orgId: string;
  findProfile: (userId: string) => Promise<{ id: string; role: Role; isActive: boolean } | null>;
  countActiveAdmins: (orgId: string) => Promise<number>;
  setActive: (userId: string, isActive: boolean) => Promise<void>;
};

// Deactivate-operator outcome - saved, invalid, last-admin block, or failure.
export type DeactivateOperatorResult =
  | { status: 'ok' }
  | { status: 'invalid' }
  | { status: 'failed'; message: string };

// Deactivate-operator use case - soft deactivate/reactivate; DB trigger is final authority.
export async function deactivateOperator(
  input: unknown,
  deps: DeactivateOperatorDeps,
): Promise<DeactivateOperatorResult> {
  const parsed = operatorDeactivateSchema.safeParse(input);
  if (!parsed.success) return { status: 'invalid' };

  try {
    const profile = await deps.findProfile(parsed.data.id);
    if (!profile) return { status: 'failed', message: messages.saveFailed };

    if (profile.role === 'admin' && profile.isActive && parsed.data.isActive === false) {
      const activeAdmins = await deps.countActiveAdmins(deps.orgId);
      if (activeAdmins <= 1) return { status: 'failed', message: messages.lastAdmin };
    }

    await deps.setActive(parsed.data.id, parsed.data.isActive);
    return { status: 'ok' };
  } catch (error) {
    const text = error instanceof Error ? error.message : '';
    if (text.includes('last_active_admin')) return { status: 'failed', message: messages.lastAdmin };
    return { status: 'failed', message: messages.saveFailed };
  }
}
