'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { createAuthUser, deleteAuthUser } from '@/infrastructure/auth/admin-users';
import {
  countActiveAdmins,
  findOperatorProfile,
  insertOperatorProfile,
  replaceOperatorMemberships,
  setOperatorActive,
  updateOperatorRole,
} from '@/infrastructure/repositories/operators';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { createOperator } from './create-operator';
import { deactivateOperator } from './deactivate-operator';
import { updateOperator } from './update-operator';

// Admin-only roles - matches design D2 (operator writes).
const ADMIN_ROLES = ['admin'] as const;

// Operator form state - includes one-time temp password after create.
export type OperatorFormState = {
  status?: 'ok' | 'error';
  message?: string;
  temporaryPassword?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

// Membership parsing - repeated areaId[] + optional isLead:<areaId> checkboxes.
function readMemberships(formData: FormData) {
  const areaIds = formData.getAll('areaId').filter((value): value is string => typeof value === 'string');
  const leadFlags = new Set(
    formData
      .getAll('isLead')
      .filter((value): value is string => typeof value === 'string'),
  );
  return areaIds.map((areaId) => ({ areaId, isLead: leadFlags.has(areaId) }));
}

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// Create-operator action - Auth admin (service role) + profile/memberships; compensate on failure.
export async function createOperatorAction(
  _previous: OperatorFormState,
  formData: FormData,
): Promise<OperatorFormState> {
  const operator = await requirePageRole(ADMIN_ROLES);
  const admin = createAdminSupabase();
  const supabase = await createServerSupabase();

  const result = await createOperator(
    {
      email: readText(formData, 'email'),
      fullName: readText(formData, 'fullName'),
      role: readText(formData, 'role'),
      temporaryPassword: readText(formData, 'temporaryPassword'),
      memberships: readMemberships(formData),
    },
    {
      orgId: operator.orgId,
      createAuthUser: (input) => createAuthUser(admin, input),
      deleteAuthUser: (userId) => deleteAuthUser(admin, userId),
      insertProfile: (input) => insertOperatorProfile(admin, input),
      replaceMemberships: (userId, memberships) => replaceOperatorMemberships(supabase, userId, memberships),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/settings/operators');
  return {
    status: 'ok',
    message: esAR.operators.created,
    temporaryPassword: result.temporaryPassword,
  };
}

// Update-operator action - role + memberships; email changes rejected in the use case.
export async function updateOperatorAction(
  _previous: OperatorFormState,
  formData: FormData,
): Promise<OperatorFormState> {
  const operator = await requirePageRole(ADMIN_ROLES);
  const supabase = await createServerSupabase();

  const result = await updateOperator(
    {
      id: readText(formData, 'id'),
      role: readText(formData, 'role'),
      memberships: readMemberships(formData),
      ...(formData.has('email') ? { email: readText(formData, 'email') } : {}),
    },
    {
      orgId: operator.orgId,
      findProfile: (userId) => findOperatorProfile(supabase, userId),
      countActiveAdmins: (orgId) => countActiveAdmins(supabase, orgId),
      updateRole: (userId, role) => updateOperatorRole(supabase, userId, role),
      replaceMemberships: (userId, memberships) => replaceOperatorMemberships(supabase, userId, memberships),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/settings/operators');
  return { status: 'ok', message: esAR.operators.saved };
}

// Deactivate-operator action - soft flag; last-admin blocked in use case + DB trigger.
export async function deactivateOperatorAction(
  _previous: OperatorFormState,
  formData: FormData,
): Promise<OperatorFormState> {
  const operator = await requirePageRole(ADMIN_ROLES);
  const supabase = await createServerSupabase();
  const isActive = formData.get('isActive') === 'true';

  const result = await deactivateOperator(
    { id: readText(formData, 'id'), isActive },
    {
      orgId: operator.orgId,
      findProfile: (userId) => findOperatorProfile(supabase, userId),
      countActiveAdmins: (orgId) => countActiveAdmins(supabase, orgId),
      setActive: (userId, active) => setOperatorActive(supabase, userId, active),
    },
  );

  if (result.status === 'invalid') return { status: 'error', message: esAR.operators.errors.saveFailed };
  if (result.status === 'failed') return { status: 'error', message: result.message };
  revalidatePath('/settings/operators');
  return { status: 'ok', message: esAR.operators.saved };
}
