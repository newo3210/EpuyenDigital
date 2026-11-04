import type { Area, Profile } from '@epuyen/shared';
import { createAreaSchema } from '@/contracts/admin-areas';
import { requireRole } from '@/features/auth/require-role';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// Create-area ports - admin insert into areas.
export type CreateAreaDeps = {
  actor: Profile;
  forbidden: () => never;
  insertArea: (input: {
    orgId: string;
    name: string;
    description: string | null;
    color: string | null;
    isActive: boolean;
  }) => Promise<Area>;
};

export type CreateAreaResult =
  | { status: 'ok'; area: Area }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'duplicate'; message: string }
  | { status: 'failed'; message: string };

// Create-area use case - admin only; new areas are never default (use set-default).
export async function createArea(input: unknown, deps: CreateAreaDeps): Promise<CreateAreaResult> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const parsed = createAreaSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const mapped: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) mapped[key] = messages[0];
    }
    return { status: 'invalid', fieldErrors: mapped };
  }

  try {
    const area = await deps.insertArea({
      orgId: deps.actor.orgId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? null,
      isActive: parsed.data.isActive,
    });
    return { status: 'ok', area };
  } catch (error) {
    const mapped = mapAdminWriteError(error, esAR.settings.areas.errors.saveFailed);
    if (mapped.status === 'duplicate') {
      return { status: 'duplicate', message: esAR.settings.areas.errors.duplicateName };
    }
    return { status: 'failed', message: mapped.message };
  }
}
