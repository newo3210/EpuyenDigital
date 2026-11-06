import { areaCreateSchema, type Area, type AreaCreateInput } from '@/contracts/areas';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.areas.errors;

// Create-area ports - org context plus the insert writer (RLS: admin).
export type CreateAreaDeps = {
  orgId: string;
  insertArea: (
    orgId: string,
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

// Create-area outcome - created entity, field errors, or persistence failure.
export type CreateAreaResult =
  | { status: 'ok'; area: Area }
  | { status: 'invalid'; fieldErrors: Partial<Record<keyof AreaCreateInput, string>> }
  | { status: 'failed'; message: string };

// Create-area use case - validates payload then persists via the repository port.
export async function createArea(input: unknown, deps: CreateAreaDeps): Promise<CreateAreaResult> {
  const parsed = areaCreateSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: 'invalid',
      fieldErrors: {
        name: flat.name?.[0],
        description: flat.description?.[0],
        color: flat.color?.[0],
        slaWarningMinutes: flat.slaWarningMinutes?.[0],
        slaCriticalMinutes: flat.slaCriticalMinutes?.[0],
      },
    };
  }

  try {
    const area = await deps.insertArea(deps.orgId, {
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
