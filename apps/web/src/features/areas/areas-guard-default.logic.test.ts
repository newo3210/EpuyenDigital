/**
 * Behavioral model of `areas_guard_default` with `pg_trigger_depth()` semantics.
 * Live Postgres is unavailable in this environment (no Docker); this unit documents
 * the promote/swap contract the migration implements. See also:
 * openspec/changes/areas-operators-admin/reports/default-area-swap-sql-proof.sql
 */

type AreaRow = { id: string; orgId: string; isDefault: boolean };

type GuardResult = { areas: AreaRow[]; error?: 'org_requires_default_area' };

// BEFORE INSERT/UPDATE OF is_default model - mirrors migration SQL.
function applyAreasGuardDefault(
  areas: AreaRow[],
  op: 'INSERT' | 'UPDATE',
  incoming: AreaRow,
  old: AreaRow | undefined,
  depth: number,
): GuardResult {
  let working = areas.map((row) => ({ ...row }));

  if (incoming.isDefault) {
    // Promote: clear peer defaults via nested UPDATEs (depth + 1).
    for (const peer of working.filter(
      (row) => row.orgId === incoming.orgId && row.id !== incoming.id && row.isDefault,
    )) {
      const nested = applyAreasGuardDefault(
        working,
        'UPDATE',
        { ...peer, isDefault: false },
        peer,
        depth + 1,
      );
      if (nested.error) return nested;
      working = nested.areas;
    }
  } else if (op === 'UPDATE' && old?.isDefault && !incoming.isDefault) {
    // Nested peer-clear from a promote must not raise (outer NEW not yet default).
    if (depth <= 1) {
      const hasOtherDefault = working.some(
        (row) => row.orgId === incoming.orgId && row.id !== incoming.id && row.isDefault,
      );
      if (!hasOtherDefault) {
        return { areas: working, error: 'org_requires_default_area' };
      }
    }
  }

  if (op === 'INSERT') {
    working = [...working, { ...incoming }];
  } else {
    working = working.map((row) => (row.id === incoming.id ? { ...incoming } : row));
  }
  return { areas: working };
}

function defaultsFor(orgId: string, areas: AreaRow[]): string[] {
  return areas.filter((row) => row.orgId === orgId && row.isDefault).map((row) => row.id);
}

const ORG = 'org-1';
const MESA = 'mesa';
const INSPECTORIA = 'inspectoria';

describe('areas_guard_default behavioral model (pg_trigger_depth)', () => {
  it('promotes Inspectoría then Mesa again (Mesa ↔ Inspectoría swap)', () => {
    let areas: AreaRow[] = [
      { id: MESA, orgId: ORG, isDefault: true },
      { id: INSPECTORIA, orgId: ORG, isDefault: false },
    ];

    const promoteInspectoria = applyAreasGuardDefault(
      areas,
      'UPDATE',
      { id: INSPECTORIA, orgId: ORG, isDefault: true },
      areas.find((row) => row.id === INSPECTORIA),
      1,
    );
    expect(promoteInspectoria.error).toBeUndefined();
    areas = promoteInspectoria.areas;
    expect(defaultsFor(ORG, areas)).toEqual([INSPECTORIA]);

    const promoteMesa = applyAreasGuardDefault(
      areas,
      'UPDATE',
      { id: MESA, orgId: ORG, isDefault: true },
      areas.find((row) => row.id === MESA),
      1,
    );
    expect(promoteMesa.error).toBeUndefined();
    areas = promoteMesa.areas;
    expect(defaultsFor(ORG, areas)).toEqual([MESA]);
  });

  it('rejects clearing the sole default at depth 1', () => {
    const areas: AreaRow[] = [
      { id: MESA, orgId: ORG, isDefault: true },
      { id: INSPECTORIA, orgId: ORG, isDefault: false },
    ];
    const result = applyAreasGuardDefault(
      areas,
      'UPDATE',
      { id: MESA, orgId: ORG, isDefault: false },
      areas[0],
      1,
    );
    expect(result.error).toBe('org_requires_default_area');
  });

  it('allows nested clear at depth > 1 (promote peer wipe)', () => {
    const areas: AreaRow[] = [
      { id: MESA, orgId: ORG, isDefault: true },
      { id: INSPECTORIA, orgId: ORG, isDefault: false },
    ];
    const nestedClear = applyAreasGuardDefault(
      areas,
      'UPDATE',
      { id: MESA, orgId: ORG, isDefault: false },
      areas[0],
      2,
    );
    expect(nestedClear.error).toBeUndefined();
    expect(defaultsFor(ORG, nestedClear.areas)).toEqual([]);
  });

  it('inserts a new default while clearing the previous one', () => {
    const areas: AreaRow[] = [{ id: MESA, orgId: ORG, isDefault: true }];
    const result = applyAreasGuardDefault(
      areas,
      'INSERT',
      { id: INSPECTORIA, orgId: ORG, isDefault: true },
      undefined,
      1,
    );
    expect(result.error).toBeUndefined();
    expect(defaultsFor(ORG, result.areas)).toEqual([INSPECTORIA]);
  });
});
