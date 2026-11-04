import type { Area, Profile } from '@epuyen/shared';
import { requireRole } from '@/features/auth/require-role';

// List-areas ports - admin sees all org areas via RLS.
export type ListAreasDeps = {
  actor: Profile;
  forbidden: () => never;
  listAreas: () => Promise<Area[]>;
};

// List-areas use case - admin-only directory of municipal areas.
export async function listAreasForAdmin(deps: ListAreasDeps): Promise<Area[]> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });
  return deps.listAreas();
}
