import type { Area } from '@/contracts/areas';

// List-areas ports - repository reader (RLS: org members).
export type ListAreasDeps = {
  listAreas: () => Promise<Area[]>;
};

// List-areas outcome - rows or a soft failure (presentation shows empty + message if needed).
export type ListAreasResult = { status: 'ok'; areas: Area[] } | { status: 'failed' };

// List-areas use case - org-scoped area directory for settings and membership pickers.
export async function listAreas(deps: ListAreasDeps): Promise<ListAreasResult> {
  try {
    const areas = await deps.listAreas();
    return { status: 'ok', areas };
  } catch {
    return { status: 'failed' };
  }
}
