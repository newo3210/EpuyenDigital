import type { Profile } from '@epuyen/shared';
import { RepositoryError } from '@/infrastructure/repositories/errors';
import { esAR } from '@/i18n/es-AR';
import { updateOperator } from './update-operator';

const ADMIN: Profile = {
  id: '00000000-0000-4000-8000-0000000000a1',
  orgId: 'aaaaaaaa-0000-4000-8000-000000000001',
  fullName: 'Admin A',
  avatarPath: null,
  role: 'admin',
  isActive: true,
};

const OPERATOR: Profile = { ...ADMIN, id: '00000000-0000-4000-8000-0000000000a2', role: 'operator' };

class ForbiddenSignal extends Error {}

function makeDeps(actor: Profile = ADMIN) {
  return {
    actor,
    forbidden: vi.fn((): never => {
      throw new ForbiddenSignal('forbidden');
    }),
    updateProfile: vi.fn(async () => undefined),
  };
}

// Update operator - last_admin mapping, deactivate path, non-admin forbidden.
describe('updateOperator', () => {
  it('deactivates an operator when the admin is allowed', async () => {
    const deps = makeDeps();
    const result = await updateOperator(
      { userId: OPERATOR.id, isActive: false },
      deps,
    );
    expect(result).toEqual({ status: 'ok' });
    expect(deps.updateProfile).toHaveBeenCalledWith({
      userId: OPERATOR.id,
      role: undefined,
      isActive: false,
      fullName: undefined,
    });
  });

  it('maps last_admin from the database', async () => {
    const deps = makeDeps();
    deps.updateProfile.mockRejectedValueOnce(
      new RepositoryError('operators.write_failed', 'P0001: last_admin'),
    );
    const result = await updateOperator({ userId: ADMIN.id, isActive: false }, deps);
    expect(result).toEqual({
      status: 'last_admin',
      message: esAR.settings.operators.errors.lastAdmin,
    });
  });

  it('forbids non-admin callers', async () => {
    const deps = makeDeps(OPERATOR);
    await expect(updateOperator({ userId: ADMIN.id, role: 'operator' }, deps)).rejects.toThrow(
      ForbiddenSignal,
    );
  });
});
