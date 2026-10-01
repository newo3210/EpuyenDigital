'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { changeErrorLogStatus } from '@/infrastructure/repositories/error-logs';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { changeErrorStatus } from './change-status';

// Support roles - who may triage incidents (RLS enforces the same set).
const SUPPORT_ROLES = ['admin', 'support'] as const;

// Status form state - outcome of the last status change (useActionState).
export type ErrorStatusFormState = {
  status?: 'ok' | 'error';
  message?: string;
};

// Change-status action - role guard, user-scoped update so RLS and the guard trigger apply.
export async function changeErrorStatusAction(
  _previous: ErrorStatusFormState,
  formData: FormData,
): Promise<ErrorStatusFormState> {
  await requirePageRole(SUPPORT_ROLES);
  const supabase = await createServerSupabase();

  const result = await changeErrorStatus(
    { id: formData.get('id'), status: formData.get('status') },
    { saveStatus: async (id, status) => void (await changeErrorLogStatus(supabase, id, status)) },
  );

  if (result.status !== 'ok') return { status: 'error', message: esAR.support.errors.actions.failed };
  revalidatePath('/support/errors');
  return { status: 'ok' };
}
