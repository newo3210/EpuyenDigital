import type { Profile } from '@epuyen/shared';
import { setDefaultAreaSchema } from '@/contracts/admin-areas';
import { requireRole } from '@/features/auth/require-role';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// Set-default ports - RPC that clears the previous default in the org.
export type SetDefaultAreaDeps = {
  actor: Profile;
  forbidden: () => never;
  setDefault: (areaId: string) => Promise<void>;
};

export type SetDefaultAreaResult =
  | { status: 'ok' }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'failed'; message: string };

// Set-default-area use case - admin marks Mesa de Entrada via SQL RPC.
export async function setDefaultArea(input: unknown, deps: SetDefaultAreaDeps): Promise<SetDefaultAreaResult> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const parsed = setDefaultAreaSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'invalid', fieldErrors: { areaId: esAR.settings.areas.errors.saveFailed } };
  }

  try {
    await deps.setDefault(parsed.data.areaId);
    return { status: 'ok' };
  } catch (error) {
    const mapped = mapAdminWriteError(error, esAR.settings.areas.errors.saveFailed);
    return { status: 'failed', message: mapped.message };
  }
}
