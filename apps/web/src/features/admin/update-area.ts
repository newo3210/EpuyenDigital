import type { Area, Profile } from '@epuyen/shared';
import { updateAreaSchema } from '@/contracts/admin-areas';
import { requireRole } from '@/features/auth/require-role';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// Update-area ports - admin update of mutable area fields.
export type UpdateAreaDeps = {
  actor: Profile;
  forbidden: () => never;
  updateArea: (input: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    isActive: boolean;
  }) => Promise<Area>;
};

export type UpdateAreaResult =
  | { status: 'ok'; area: Area }
  | { status: 'invalid'; fieldErrors: Record<string, string> }
  | { status: 'duplicate'; message: string }
  | { status: 'failed'; message: string };

// Update-area use case - admin only; does not flip is_default (RPC owns that).
export async function updateArea(input: unknown, deps: UpdateAreaDeps): Promise<UpdateAreaResult> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const parsed = updateAreaSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const mapped: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) mapped[key] = messages[0];
    }
    return { status: 'invalid', fieldErrors: mapped };
  }

  try {
    const area = await deps.updateArea({
      id: parsed.data.id,
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
