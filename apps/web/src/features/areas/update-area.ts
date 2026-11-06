import { areaUpdateSchema, type Area, type AreaUpdateInput } from '@/contracts/areas';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.areas.errors;

// Update-area ports - identified writer (RLS: admin).
export type UpdateAreaDeps = {
  updateArea: (
    areaId: string,
    input: {
      name: string;
      description: string | null;
      color: string;
      is_active: boolean;
      is_default: boolean;
      sla_warning_minutes: number | null;
      sla_critical_minutes: number | null;
    },
  ) => Promise<Area>;
};

// Update-area outcome - updated entity, field errors, or persistence failure.
export type UpdateAreaResult =
  | { status: 'ok'; area: Area }
  | { status: 'invalid'; fieldErrors: Partial<Record<keyof AreaUpdateInput, string>> }
  | { status: 'failed'; message: string };

// Update-area use case - validates then persists; maps DB uniqueness/default errors.
export async function updateArea(input: unknown, deps: UpdateAreaDeps): Promise<UpdateAreaResult> {
  const parsed = areaUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: 'invalid',
      fieldErrors: {
        id: flat.id?.[0],
        name: flat.name?.[0],
        description: flat.description?.[0],
        color: flat.color?.[0],
        slaWarningMinutes: flat.slaWarningMinutes?.[0],
        slaCriticalMinutes: flat.slaCriticalMinutes?.[0],
      },
    };
  }

  try {
    const area = await deps.updateArea(parsed.data.id, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color,
      is_active: parsed.data.isActive,
      is_default: parsed.data.isDefault,
      sla_warning_minutes: parsed.data.slaWarningMinutes ?? null,
      sla_critical_minutes: parsed.data.slaCriticalMinutes ?? null,
    });
    return { status: 'ok', area };
  } catch (error) {
    const text = error instanceof Error ? error.message : '';
    if (text.includes('areas_org_name_unique') || text.includes('duplicate key')) {
      return { status: 'failed', message: messages.duplicateName };
    }
    if (text.includes('org_requires_default_area')) {
      return { status: 'failed', message: messages.defaultRequired };
    }
    return { status: 'failed', message: messages.saveFailed };
  }
}
