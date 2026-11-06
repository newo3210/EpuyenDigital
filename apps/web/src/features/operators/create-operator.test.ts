import { esAR } from '@/i18n/es-AR';
import { createOperator, type CreateOperatorDeps } from './create-operator';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-0000000000b1';
const AREA_ID = '00000000-0000-4000-8000-000000000010';

const valid = {
  email: 'nuevo@epuyen.gob.ar',
  fullName: 'Nuevo Operador',
  role: 'operator' as const,
  temporaryPassword: 'temporal-seguro',
  memberships: [{ areaId: AREA_ID, isLead: false }],
};

// Test deps - Auth create + profile/memberships with optional failure points.
function makeDeps(options?: { failProfile?: boolean; failMemberships?: boolean; failAuth?: boolean }) {
  const deleteAuthUser = vi.fn(async () => undefined);
  const deps: CreateOperatorDeps = {
    orgId: ORG_ID,
    createAuthUser: vi.fn(async () => {
      if (options?.failAuth) throw new Error('User already registered');
      return { id: USER_ID };
    }),
    deleteAuthUser,
    insertProfile: vi.fn(async () => {
      if (options?.failProfile) throw new Error('profiles write failed');
    }),
    replaceMemberships: vi.fn(async () => {
      if (options?.failMemberships) throw new Error('memberships write failed');
    }),
  };
  return { deps, deleteAuthUser };
}

describe('createOperator', () => {
  it('creates auth user, profile and memberships and returns the temp password once', async () => {
    const { deps, deleteAuthUser } = makeDeps();
    const result = await createOperator(valid, deps);
    expect(result).toEqual({ status: 'ok', userId: USER_ID, temporaryPassword: 'temporal-seguro' });
    expect(deps.createAuthUser).toHaveBeenCalled();
    expect(deps.insertProfile).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID, email: valid.email }));
    expect(deps.replaceMemberships).toHaveBeenCalledWith(USER_ID, valid.memberships);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it('compensates by deleting the Auth user when profile insert fails', async () => {
    const { deps, deleteAuthUser } = makeDeps({ failProfile: true });
    await expect(createOperator(valid, deps)).resolves.toEqual({
      status: 'failed',
      message: esAR.operators.errors.createFailed,
    });
    expect(deleteAuthUser).toHaveBeenCalledWith(USER_ID);
  });

  it('compensates when membership replace fails', async () => {
    const { deps, deleteAuthUser } = makeDeps({ failMemberships: true });
    await expect(createOperator(valid, deps)).resolves.toMatchObject({ status: 'failed' });
    expect(deleteAuthUser).toHaveBeenCalledWith(USER_ID);
  });

  it('maps duplicate Auth email without compensation', async () => {
    const { deps, deleteAuthUser } = makeDeps({ failAuth: true });
    await expect(createOperator(valid, deps)).resolves.toEqual({
      status: 'failed',
      message: esAR.operators.errors.duplicateEmail,
    });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });
});
