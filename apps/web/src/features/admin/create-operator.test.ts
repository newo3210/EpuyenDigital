import type { Profile } from '@epuyen/shared';
import { RepositoryError } from '@/infrastructure/repositories/errors';
import { esAR } from '@/i18n/es-AR';
import { createOperator } from './create-operator';

const ADMIN: Profile = {
  id: '00000000-0000-4000-8000-0000000000a1',
  orgId: 'aaaaaaaa-0000-4000-8000-000000000001',
  fullName: 'Admin A',
  avatarPath: null,
  role: 'admin',
  isActive: true,
};

const OPERATOR: Profile = { ...ADMIN, id: '00000000-0000-4000-8000-0000000000a2', role: 'operator' };

const FOREIGN_AREA_ID = 'bbbbbbbb-0000-4000-8000-000000000010';
const CREATED_USER_ID = '00000000-0000-4000-8000-000000000099';

// Forbidden signal - stands in for Next's forbidden().
class ForbiddenSignal extends Error {}

function makeDeps(actor: Profile = ADMIN) {
  return {
    actor,
    forbidden: vi.fn((): never => {
      throw new ForbiddenSignal('forbidden');
    }),
    createAuthUser: vi.fn(async () => ({ id: CREATED_USER_ID })),
    insertProfile: vi.fn(async () => undefined),
    assertAreasInOrg: vi.fn(async () => undefined),
    assignMemberships: vi.fn(async () => undefined),
    deleteAuthUser: vi.fn(async () => undefined),
  };
}

const VALID = {
  email: 'nuevo@epuyen.gob.ar',
  fullName: 'Nuevo Operador',
  role: 'operator' as const,
  temporaryPassword: 'temporaria-10',
  areaIds: ['aaaaaaaa-0000-4000-8000-000000000010'],
};

// Create operator - admin happy path, forbidden non-admin, duplicate email.
describe('createOperator', () => {
  it('creates auth user, profile and memberships for an admin', async () => {
    const deps = makeDeps();
    const result = await createOperator(VALID, deps);

    expect(result).toEqual({
      status: 'ok',
      userId: CREATED_USER_ID,
      temporaryPassword: 'temporaria-10',
    });
    expect(deps.assertAreasInOrg).toHaveBeenCalledWith(VALID.areaIds);
    expect(deps.createAuthUser).toHaveBeenCalledWith({
      email: 'nuevo@epuyen.gob.ar',
      password: 'temporaria-10',
    });
    expect(deps.insertProfile).toHaveBeenCalledWith({
      id: CREATED_USER_ID,
      orgId: ADMIN.orgId,
      fullName: 'Nuevo Operador',
      role: 'operator',
    });
    expect(deps.assignMemberships).toHaveBeenCalledWith(CREATED_USER_ID, VALID.areaIds);
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('forbids non-admin callers before touching auth', async () => {
    const deps = makeDeps(OPERATOR);
    await expect(createOperator(VALID, deps)).rejects.toThrow(ForbiddenSignal);
    expect(deps.assertAreasInOrg).not.toHaveBeenCalled();
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });

  it('rejects wrong-org areaIds before creating an Auth user', async () => {
    const deps = makeDeps();
    deps.assertAreasInOrg.mockRejectedValueOnce(
      new RepositoryError(
        'areas.foreign_org',
        'one or more area ids are missing or belong to another organization',
      ),
    );

    const result = await createOperator({ ...VALID, areaIds: [FOREIGN_AREA_ID] }, deps);

    expect(result).toEqual({
      status: 'failed',
      message: esAR.settings.operators.errors.invalidAreas,
    });
    expect(deps.assertAreasInOrg).toHaveBeenCalledWith([FOREIGN_AREA_ID]);
    expect(deps.createAuthUser).not.toHaveBeenCalled();
    expect(deps.assignMemberships).not.toHaveBeenCalled();
  });

  it('rolls back Auth user when profile insert fails', async () => {
    const deps = makeDeps();
    deps.insertProfile.mockRejectedValueOnce(new Error('profile insert failed'));

    const result = await createOperator(VALID, deps);

    expect(result.status).toBe('failed');
    expect(deps.createAuthUser).toHaveBeenCalledOnce();
    expect(deps.deleteAuthUser).toHaveBeenCalledWith(CREATED_USER_ID);
    expect(deps.assignMemberships).not.toHaveBeenCalled();
  });

  it('still fails when Auth rollback itself fails after profile error', async () => {
    const deps = makeDeps();
    deps.insertProfile.mockRejectedValueOnce(new Error('profile insert failed'));
    deps.deleteAuthUser.mockRejectedValueOnce(new Error('deleteUser failed'));

    const result = await createOperator(VALID, deps);

    expect(result.status).toBe('failed');
    expect(deps.deleteAuthUser).toHaveBeenCalledWith(CREATED_USER_ID);
  });

  it('maps duplicate email failures', async () => {
    const deps = makeDeps();
    deps.createAuthUser.mockRejectedValueOnce(new Error('already been registered'));
    const result = await createOperator(VALID, deps);
    expect(result.status).toBe('duplicate');
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('rejects short temporary passwords', async () => {
    const deps = makeDeps();
    const result = await createOperator({ ...VALID, temporaryPassword: 'short' }, deps);
    expect(result.status).toBe('invalid');
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });
});
