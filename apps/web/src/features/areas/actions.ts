'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { insertArea, updateArea as updateAreaRow } from '@/infrastructure/repositories/areas';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { createArea } from './create-area';
import { readBoolean } from './form-data';
import { updateArea } from './update-area';

// Admin-only roles - matches design D2 (area writes).
const ADMIN_ROLES = ['admin'] as const;

// Area form state - outcome for useActionState on create/edit forms.
export type AreaFormState = {
  status?: 'ok' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

function readOptionalText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// Create-area action - admin guard, user-scoped insert so RLS applies.
export async function createAreaAction(_previous: AreaFormState, formData: FormData): Promise<AreaFormState> {
  const operator = await requirePageRole(ADMIN_ROLES);
  const supabase = await createServerSupabase();

  const result = await createArea(
    {
      name: readOptionalText(formData, 'name'),
      description: readOptionalText(formData, 'description'),
      color: readOptionalText(formData, 'color'),
      isActive: readBoolean(formData, 'isActive', true),
      isDefault: readBoolean(formData, 'isDefault'),
      slaWarningMinutes: readOptionalText(formData, 'slaWarningMinutes'),
      slaCriticalMinutes: readOptionalText(formData, 'slaCriticalMinutes'),
    },
    {
      orgId: operator.orgId,
      insertArea: (orgId, input) => insertArea(supabase, orgId, input),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/settings/areas');
  return { status: 'ok', message: esAR.areas.saved };
}

// Update-area action - admin guard, user-scoped update so RLS + default trigger apply.
export async function updateAreaAction(_previous: AreaFormState, formData: FormData): Promise<AreaFormState> {
  await requirePageRole(ADMIN_ROLES);
  const supabase = await createServerSupabase();

  const result = await updateArea(
    {
      id: readOptionalText(formData, 'id'),
      name: readOptionalText(formData, 'name'),
      description: readOptionalText(formData, 'description'),
      color: readOptionalText(formData, 'color'),
      isActive: readBoolean(formData, 'isActive'),
      isDefault: readBoolean(formData, 'isDefault'),
      slaWarningMinutes: readOptionalText(formData, 'slaWarningMinutes'),
      slaCriticalMinutes: readOptionalText(formData, 'slaCriticalMinutes'),
    },
    { updateArea: (areaId, input) => updateAreaRow(supabase, areaId, input) },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/settings/areas');
  return { status: 'ok', message: esAR.areas.saved };
}
