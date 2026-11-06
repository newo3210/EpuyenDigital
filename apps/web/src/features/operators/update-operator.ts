import type { Role } from '@epuyen/shared';
import { operatorUpdateSchema, type MembershipInput, type OperatorUpdateInput } from '@/contracts/operators';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.operators.errors;

// Update-operator ports - role/membership writers plus last-admin preflight reads.
export type UpdateOperatorDeps = {
  orgId: string;
  findProfile: (userId: string) => Promise<{ id: string; role: Role; isActive: boolean; email: string | null } | null>;
  countActiveAdmins: (orgId: string) => Promise<number>;
  updateRole: (userId: string, role: Role) => Promise<void>;
  replaceMemberships: (userId: string, memberships: MembershipInput[]) => Promise<void>;
};

// Update-operator outcome - saved, invalid, last-admin block, or persistence failure.
export type UpdateOperatorResult =
  | { status: 'ok' }
  | { status: 'invalid'; fieldErrors: Partial<Record<keyof OperatorUpdateInput | 'email', string>> }
  | { status: 'failed'; message: string };

// Update-operator use case - rejects email changes (D4); guards last admin before demotion.
export async function updateOperator(input: unknown, deps: UpdateOperatorDeps): Promise<UpdateOperatorResult> {
  if (input && typeof input === 'object' && 'email' in input && (input as { email?: unknown }).email !== undefined) {
    return { status: 'invalid', fieldErrors: { email: messages.emailImmutable } };
  }

  const parsed = operatorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: 'invalid',
      fieldErrors: {
        id: flat.id?.[0],
        role: flat.role?.[0],
        memberships: flat.memberships?.[0],
      },
    };
  }

  try {
    const profile = await deps.findProfile(parsed.data.id);
    if (!profile) return { status: 'failed', message: messages.saveFailed };

    if (profile.role === 'admin' && profile.isActive && parsed.data.role !== 'admin') {
      const activeAdmins = await deps.countActiveAdmins(deps.orgId);
      if (activeAdmins <= 1) return { status: 'failed', message: messages.lastAdmin };
    }

    await deps.updateRole(parsed.data.id, parsed.data.role);
    await deps.replaceMemberships(parsed.data.id, parsed.data.memberships);
    return { status: 'ok' };
  } catch (error) {
    const text = error instanceof Error ? error.message : '';
    if (text.includes('last_active_admin')) return { status: 'failed', message: messages.lastAdmin };
    return { status: 'failed', message: messages.saveFailed };
  }
}
