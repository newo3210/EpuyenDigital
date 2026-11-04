import type { Area, Profile } from '@epuyen/shared';
import { assignMembership } from './assign-membership';
import { createArea } from './create-area';
import { removeMembership } from './remove-membership';
import { setDefaultArea } from './set-default-area';
import { updateArea } from './update-area';

const ADMIN: Profile = {
  id: '00000000-0000-4000-8000-0000000000a1',
  orgId: 'aaaaaaaa-0000-4000-8000-000000000001',
  fullName: 'Admin A',
  avatarPath: null,
  role: 'admin',
  isActive: true,
};

const OPERATOR: Profile = { ...ADMIN, role: 'operator', id: '00000000-0000-4000-8000-0000000000a2' };

const AREA: Area = {
  id: 'aaaaaaaa-0000-4000-8000-000000000012',
  orgId: ADMIN.orgId,
  name: 'Obras',
  description: null,
  color: '#13463a',
  isActive: true,
  isDefault: false,
  slaWarningMinutes: null,
  slaCriticalMinutes: null,
};

class ForbiddenSignal extends Error {}

const forbidden = (): never => {
  throw new ForbiddenSignal('forbidden');
};

// Areas + memberships - admin mutations succeed; non-admin is forbidden.
describe('area admin use cases', () => {
  it('creates an area for an admin', async () => {
    const insertArea = vi.fn(async () => AREA);
    const result = await createArea(
      { name: 'Obras', color: '#13463a', isActive: true },
      { actor: ADMIN, forbidden, insertArea },
    );
    expect(result.status).toBe('ok');
    expect(insertArea).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ADMIN.orgId, name: 'Obras', isActive: true }),
    );
  });

  it('forbids non-admin area create', async () => {
    await expect(
      createArea(
        { name: 'Hack' },
        { actor: OPERATOR, forbidden, insertArea: vi.fn() },
      ),
    ).rejects.toThrow(ForbiddenSignal);
  });

  it('updates an area for an admin', async () => {
    const update = vi.fn(async () => ({ ...AREA, name: 'Obras Públicas' }));
    const result = await updateArea(
      { id: AREA.id, name: 'Obras Públicas', isActive: true },
      { actor: ADMIN, forbidden, updateArea: update },
    );
    expect(result.status).toBe('ok');
  });

  it('sets the default area via the RPC port', async () => {
    const setDefault = vi.fn(async () => undefined);
    const result = await setDefaultArea(
      { areaId: AREA.id },
      { actor: ADMIN, forbidden, setDefault },
    );
    expect(result).toEqual({ status: 'ok' });
    expect(setDefault).toHaveBeenCalledWith(AREA.id);
  });

  it('assigns and removes memberships', async () => {
    const upsertMembership = vi.fn(async () => ({
      areaId: AREA.id,
      userId: OPERATOR.id,
      isLead: false,
    }));
    const deleteMembership = vi.fn(async () => undefined);

    const assigned = await assignMembership(
      { areaId: AREA.id, userId: OPERATOR.id, isLead: false },
      { actor: ADMIN, forbidden, upsertMembership },
    );
    expect(assigned.status).toBe('ok');

    const removed = await removeMembership(
      { areaId: AREA.id, userId: OPERATOR.id },
      { actor: ADMIN, forbidden, deleteMembership },
    );
    expect(removed).toEqual({ status: 'ok' });
  });

  it('forbids non-admin membership writes', async () => {
    await expect(
      assignMembership(
        { areaId: AREA.id, userId: OPERATOR.id },
        { actor: OPERATOR, forbidden, upsertMembership: vi.fn() },
      ),
    ).rejects.toThrow(ForbiddenSignal);
  });
});
