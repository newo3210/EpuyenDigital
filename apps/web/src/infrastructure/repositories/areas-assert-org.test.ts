import { RepositoryError } from './errors';
import { assertAreaIdsInOrg } from './areas';

const ORG_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const AREA_A = 'aaaaaaaa-0000-4000-8000-000000000010';
const AREA_B_FOREIGN = 'bbbbbbbb-0000-4000-8000-000000000010';

function mockClient(rows: Array<{ id: string }>) {
  const inFn = vi.fn(async () => ({ data: rows, error: null }));
  const eqFn = vi.fn(() => ({ in: inFn }));
  const selectFn = vi.fn(() => ({ eq: eqFn }));
  const fromFn = vi.fn(() => ({ select: selectFn }));
  return {
    client: { from: fromFn } as never,
    fromFn,
    selectFn,
    eqFn,
    inFn,
  };
}

// assertAreaIdsInOrg - elevated-client IDOR guard for membership assigns.
describe('assertAreaIdsInOrg', () => {
  it('resolves when every id belongs to the org', async () => {
    const mock = mockClient([{ id: AREA_A }]);
    await expect(assertAreaIdsInOrg(mock.client, ORG_A, [AREA_A])).resolves.toBeUndefined();
    expect(mock.eqFn).toHaveBeenCalledWith('org_id', ORG_A);
    expect(mock.inFn).toHaveBeenCalledWith('id', [AREA_A]);
  });

  it('rejects when any area id is missing or wrong-org', async () => {
    const mock = mockClient([{ id: AREA_A }]);
    await expect(assertAreaIdsInOrg(mock.client, ORG_A, [AREA_A, AREA_B_FOREIGN])).rejects.toBeInstanceOf(
      RepositoryError,
    );
    await expect(assertAreaIdsInOrg(mock.client, ORG_A, [AREA_A, AREA_B_FOREIGN])).rejects.toMatchObject({
      code: 'areas.foreign_org',
    });
  });

  it('no-ops for an empty id list', async () => {
    const mock = mockClient([]);
    await expect(assertAreaIdsInOrg(mock.client, ORG_A, [])).resolves.toBeUndefined();
    expect(mock.fromFn).not.toHaveBeenCalled();
  });
});
