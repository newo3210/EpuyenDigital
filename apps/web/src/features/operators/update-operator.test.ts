import { esAR } from '@/i18n/es-AR';
import { updateOperator, type UpdateOperatorDeps } from './update-operator';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a1';
const AREA_ID = '00000000-0000-4000-8000-000000000011';

function makeDeps(activeAdmins: number): UpdateOperatorDeps {
  return {
    orgId: ORG_ID,
    findProfile: vi.fn(async () => ({ id: ADMIN_ID, role: 'admin' as const, isActive: true, email: 'a@epuyen.gob.ar' })),
    countActiveAdmins: vi.fn(async () => activeAdmins),
    updateRole: vi.fn(async () => undefined),
    replaceMemberships: vi.fn(async () => undefined),
  };
}

describe('updateOperator', () => {
  it('rejects email changes after create', async () => {
    const deps = makeDeps(2);
    const result = await updateOperator(
      { id: ADMIN_ID, role: 'admin', memberships: [], email: 'other@epuyen.gob.ar' },
      deps,
    );
    expect(result).toEqual({ status: 'invalid', fieldErrors: { email: esAR.operators.errors.emailImmutable } });
    expect(deps.updateRole).not.toHaveBeenCalled();
  });

  it('blocks demoting the last active admin', async () => {
    const deps = makeDeps(1);
    await expect(
      updateOperator({ id: ADMIN_ID, role: 'operator', memberships: [] }, deps),
    ).resolves.toEqual({ status: 'failed', message: esAR.operators.errors.lastAdmin });
    expect(deps.updateRole).not.toHaveBeenCalled();
  });

  it('allows demotion when another active admin remains', async () => {
    const deps = makeDeps(2);
    await expect(
      updateOperator(
        { id: ADMIN_ID, role: 'operator', memberships: [{ areaId: AREA_ID, isLead: true }] },
        deps,
      ),
    ).resolves.toEqual({ status: 'ok' });
    expect(deps.updateRole).toHaveBeenCalledWith(ADMIN_ID, 'operator');
    expect(deps.replaceMemberships).toHaveBeenCalled();
  });
});
