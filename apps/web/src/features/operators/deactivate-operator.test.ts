import { esAR } from '@/i18n/es-AR';
import { deactivateOperator, type DeactivateOperatorDeps } from './deactivate-operator';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';

function makeDeps(activeAdmins: number): DeactivateOperatorDeps {
  return {
    orgId: ORG_ID,
    findProfile: vi.fn(async () => ({ id: ADMIN_ID, role: 'admin' as const, isActive: true })),
    countActiveAdmins: vi.fn(async () => activeAdmins),
    setActive: vi.fn(async () => undefined),
  };
}

describe('deactivateOperator', () => {
  it('blocks deactivating the last active admin', async () => {
    const deps = makeDeps(1);
    await expect(deactivateOperator({ id: ADMIN_ID, isActive: false }, deps)).resolves.toEqual({
      status: 'failed',
      message: esAR.operators.errors.lastAdmin,
    });
    expect(deps.setActive).not.toHaveBeenCalled();
  });

  it('deactivates when another admin remains', async () => {
    const deps = makeDeps(2);
    await expect(deactivateOperator({ id: ADMIN_ID, isActive: false }, deps)).resolves.toEqual({ status: 'ok' });
    expect(deps.setActive).toHaveBeenCalledWith(ADMIN_ID, false);
  });
});
