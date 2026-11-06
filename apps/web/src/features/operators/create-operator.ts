import { operatorCreateSchema, type OperatorCreateInput } from '@/contracts/operators';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.operators.errors;

// Auth create result - new user id from the Admin API.
export type CreatedAuthUser = { id: string };

// Create-operator ports - Auth admin + profile/membership writers + compensation delete.
export type CreateOperatorDeps = {
  orgId: string;
  createAuthUser: (input: { email: string; password: string }) => Promise<CreatedAuthUser>;
  deleteAuthUser: (userId: string) => Promise<void>;
  insertProfile: (input: {
    id: string;
    orgId: string;
    email: string;
    fullName: string;
    role: OperatorCreateInput['role'];
  }) => Promise<void>;
  replaceMemberships: (userId: string, memberships: OperatorCreateInput['memberships']) => Promise<void>;
};

// Create-operator outcome - temp password echoed once, validation errors, or failure after compensation.
export type CreateOperatorResult =
  | { status: 'ok'; userId: string; temporaryPassword: string }
  | { status: 'invalid'; fieldErrors: Partial<Record<keyof OperatorCreateInput, string>> }
  | { status: 'failed'; message: string };

// Create-operator use case - Auth → profile → memberships; compensate Auth user on later failure.
export async function createOperator(input: unknown, deps: CreateOperatorDeps): Promise<CreateOperatorResult> {
  const parsed = operatorCreateSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: 'invalid',
      fieldErrors: {
        email: flat.email?.[0],
        fullName: flat.fullName?.[0],
        role: flat.role?.[0],
        temporaryPassword: flat.temporaryPassword?.[0],
        memberships: flat.memberships?.[0],
      },
    };
  }

  let authUserId: string | null = null;
  try {
    const authUser = await deps.createAuthUser({
      email: parsed.data.email,
      password: parsed.data.temporaryPassword,
    });
    authUserId = authUser.id;

    await deps.insertProfile({
      id: authUser.id,
      orgId: deps.orgId,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
    });

    await deps.replaceMemberships(authUser.id, parsed.data.memberships);

    return {
      status: 'ok',
      userId: authUser.id,
      temporaryPassword: parsed.data.temporaryPassword,
    };
  } catch (error) {
    if (authUserId) {
      try {
        await deps.deleteAuthUser(authUserId);
      } catch {
        // Compensation best-effort - surface the original failure below.
      }
    }

    const text = error instanceof Error ? error.message : '';
    if (text.toLowerCase().includes('already') || text.includes('duplicate') || text.includes('unique')) {
      return { status: 'failed', message: messages.duplicateEmail };
    }
    return { status: 'failed', message: messages.createFailed };
  }
}
