import type { Profile } from '@epuyen/shared';
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

// Forbidden signal - stands in for Next's forbidden().
class ForbiddenSignal extends Error {}

function makeDeps(actor: Profile = ADMIN) {
  return {
    actor,
    forbidden: vi.fn((): never => {
      throw new ForbiddenSignal('forbidden');
    }),
    createAuthUser: vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000099' })),
    insertProfile: vi.fn(async () => undefined),
    assignMemberships: vi.fn(async () => undefined),
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
      userId: '00000000-0000-4000-8000-000000000099',
      temporaryPassword: 'temporaria-10',
    });
    expect(deps.createAuthUser).toHaveBeenCalledWith({
      email: 'nuevo@epuyen.gob.ar',
      password: 'temporaria-10',
    });
    expect(deps.insertProfile).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000099',
      orgId: ADMIN.orgId,
      fullName: 'Nuevo Operador',
      role: 'operator',
    });
    expect(deps.assignMemberships).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000099', VALID.areaIds);
  });

  it('forbids non-admin callers before touching auth', async () => {
    const deps = makeDeps(OPERATOR);
    await expect(createOperator(VALID, deps)).rejects.toThrow(ForbiddenSignal);
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });

  it('maps duplicate email failures', async () => {
    const deps = makeDeps();
    deps.createAuthUser.mockRejectedValueOnce(new Error('already been registered'));
    const result = await createOperator(VALID, deps);
    expect(result.status).toBe('duplicate');
  });

  it('rejects short temporary passwords', async () => {
    const deps = makeDeps();
    const result = await createOperator({ ...VALID, temporaryPassword: 'short' }, deps);
    expect(result.status).toBe('invalid');
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });
});
