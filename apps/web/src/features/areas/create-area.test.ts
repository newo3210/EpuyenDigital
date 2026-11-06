import { esAR } from '@/i18n/es-AR';
import { createArea, type CreateAreaDeps } from './create-area';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const AREA_ID = '00000000-0000-4000-8000-000000000012';

// Test deps - insert port that returns a persisted area unless told to fail.
function makeDeps(errorMessage?: string): CreateAreaDeps {
  return {
    orgId: ORG_ID,
    insertArea: vi.fn(async (_orgId, input) => {
      if (errorMessage) throw new Error(errorMessage);
      return {
        id: AREA_ID,
        orgId: ORG_ID,
        name: input.name,
        description: input.description,
        color: input.color,
        isActive: input.is_active,
        isDefault: input.is_default,
        slaWarningMinutes: input.sla_warning_minutes,
        slaCriticalMinutes: input.sla_critical_minutes,
      };
    }),
  };
}

const valid = {
  name: 'Obras',
  color: '#112233',
  isActive: true,
  isDefault: false,
  slaWarningMinutes: 15,
  slaCriticalMinutes: 45,
};

describe('createArea', () => {
  it('persists a valid area', async () => {
    const deps = makeDeps();
    const result = await createArea(valid, deps);
    expect(result.status).toBe('ok');
    expect(deps.insertArea).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({ name: 'Obras', color: '#112233' }));
  });

  it('returns field errors for invalid color', async () => {
    const deps = makeDeps();
    const result = await createArea({ ...valid, color: 'red' }, deps);
    expect(result.status).toBe('invalid');
    expect(deps.insertArea).not.toHaveBeenCalled();
  });

  it('maps duplicate name failures', async () => {
    const deps = makeDeps('areas_org_name_unique');
    await expect(createArea(valid, deps)).resolves.toEqual({
      status: 'failed',
      message: esAR.areas.errors.duplicateName,
    });
  });
});
