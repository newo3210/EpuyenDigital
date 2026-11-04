'use server';

import { revalidatePath } from 'next/cache';
import { forbidden } from 'next/navigation';
import type { Role } from '@epuyen/shared';
import { getCurrentOperator } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { deleteMembership, listMemberships, upsertMembership } from '@/infrastructure/repositories/area-members';
import { insertArea, listAreas, setDefaultArea as setDefaultAreaRpc, updateAreaRow } from '@/infrastructure/repositories/areas';
import {
  insertOperatorProfile,
  listOrgProfiles,
  updateOperatorProfile,
} from '@/infrastructure/repositories/operators';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { assignMembership } from './assign-membership';
import { createArea } from './create-area';
import { createOperator } from './create-operator';
import { removeMembership } from './remove-membership';
import { setDefaultArea } from './set-default-area';
import { updateArea } from './update-area';
import { updateOperator } from './update-operator';

// Shared form state - status message plus optional field errors for admin forms.
export type AdminFormState = {
  status?: 'ok' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
  temporaryPassword?: string;
};

const AREAS_PATH = '/settings/areas';
const OPERATORS_PATH = '/settings/operators';

// Create-area action - admin RLS insert; revalidates the areas list.
export async function createAreaAction(_previous: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const actor = await getCurrentOperator();
  const supabase = await createServerSupabase();
  const result = await createArea(
    {
      name: formData.get('name'),
      description: formData.get('description') ?? '',
      color: formData.get('color') ?? '',
      isActive: formData.get('isActive') === 'true' || formData.get('isActive') === 'on',
    },
    {
      actor,
      forbidden,
      insertArea: (input) => insertArea(supabase, input),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath(AREAS_PATH);
  return { status: 'ok', message: esAR.settings.areas.saved };
}

// Update-area action - admin RLS update of mutable fields.
export async function updateAreaAction(_previous: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const actor = await getCurrentOperator();
  const supabase = await createServerSupabase();

  const result = await updateArea(
    {
      id: formData.get('id'),
      name: formData.get('name'),
      description: formData.get('description') ?? '',
      color: formData.get('color') ?? '',
      isActive: formData.get('isActive') === 'true' || formData.get('isActive') === 'on',
    },
    {
      actor,
      forbidden,
      updateArea: (input) => updateAreaRow(supabase, input),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath(AREAS_PATH);
  return { status: 'ok', message: esAR.settings.areas.saved };
}

// Set-default-area action - RPC clears previous default.
export async function setDefaultAreaAction(_previous: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const actor = await getCurrentOperator();
  const supabase = await createServerSupabase();

  const result = await setDefaultArea(
    { areaId: formData.get('areaId') },
    {
      actor,
      forbidden,
      setDefault: (areaId) => setDefaultAreaRpc(supabase, areaId),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath(AREAS_PATH);
  return { status: 'ok', message: esAR.settings.areas.defaultSaved };
}

// Create-operator action - service-role auth user + profile; temp password returned once.
export async function createOperatorAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await getCurrentOperator();
  const admin = createAdminSupabase();
  const areaIds = formData.getAll('areaIds').filter((value): value is string => typeof value === 'string');

  const result = await createOperator(
    {
      email: formData.get('email'),
      fullName: formData.get('fullName'),
      role: formData.get('role'),
      temporaryPassword: formData.get('temporaryPassword'),
      areaIds,
    },
    {
      actor,
      forbidden,
      createAuthUser: async ({ email, password }) => {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) throw error;
        return { id: data.user.id };
      },
      insertProfile: async (input) => {
        await insertOperatorProfile(admin, input);
      },
      assignMemberships: async (userId, ids) => {
        for (const areaId of ids) {
          await upsertMembership(admin, { areaId, userId, isLead: false });
        }
      },
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath(OPERATORS_PATH);
  return {
    status: 'ok',
    message: esAR.settings.operators.created,
    temporaryPassword: result.temporaryPassword,
  };
}

// Update-operator action - role / active / name via user-scoped client (admin RLS + last_admin).
export async function updateOperatorAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await getCurrentOperator();
  const supabase = await createServerSupabase();
  const roleRaw = formData.get('role');
  const fullNameRaw = formData.get('fullName');
  const isActiveRaw = formData.get('isActive');

  const result = await updateOperator(
    {
      userId: formData.get('userId'),
      role: typeof roleRaw === 'string' && roleRaw.length > 0 ? roleRaw : undefined,
      isActive: isActiveRaw === null || isActiveRaw === '' ? undefined : isActiveRaw === 'true',
      fullName: typeof fullNameRaw === 'string' && fullNameRaw.length > 0 ? fullNameRaw : undefined,
    },
    {
      actor,
      forbidden,
      updateProfile: async (input) => {
        await updateOperatorProfile(supabase, input);
      },
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath(OPERATORS_PATH);
  return { status: 'ok', message: esAR.settings.operators.updated };
}

// Assign-membership action - admin upsert.
export async function assignMembershipAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await getCurrentOperator();
  const supabase = await createServerSupabase();
  const isLeadRaw = formData.get('isLead');

  const result = await assignMembership(
    {
      areaId: formData.get('areaId'),
      userId: formData.get('userId'),
      isLead: isLeadRaw === 'true' || isLeadRaw === 'on',
    },
    {
      actor,
      forbidden,
      upsertMembership: (input) => upsertMembership(supabase, input),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath(OPERATORS_PATH);
  return { status: 'ok', message: esAR.settings.operators.membershipSaved };
}

// Remove-membership action - admin delete.
export async function removeMembershipAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const actor = await getCurrentOperator();
  const supabase = await createServerSupabase();

  const result = await removeMembership(
    {
      areaId: formData.get('areaId'),
      userId: formData.get('userId'),
    },
    {
      actor,
      forbidden,
      deleteMembership: (areaId, userId) => deleteMembership(supabase, areaId, userId),
    },
  );

  if (result.status === 'invalid') return { status: 'error', fieldErrors: result.fieldErrors };
  if (result.status !== 'ok') return { status: 'error', message: result.message };
  revalidatePath(OPERATORS_PATH);
  return { status: 'ok', message: esAR.settings.operators.membershipSaved };
}

// Load helpers for pages - admin-gated lists used by server components.
export async function loadAdminAreas() {
  const actor = await getCurrentOperator();
  if (actor.role !== 'admin') return forbidden();
  const supabase = await createServerSupabase();
  return listAreas(supabase);
}

export async function loadAdminOperators() {
  const actor = await getCurrentOperator();
  if (actor.role !== 'admin') return forbidden();

  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const profiles = await listOrgProfiles(supabase, actor.orgId);
  const memberships = await listMemberships(supabase);

  const emailById = new Map<string, string | null>();
  for (const profile of profiles) {
    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error) throw error;
    emailById.set(profile.id, data.user.email ?? null);
  }

  const membershipsByUser = new Map<string, typeof memberships>();
  for (const membership of memberships) {
    const list = membershipsByUser.get(membership.userId) ?? [];
    list.push(membership);
    membershipsByUser.set(membership.userId, list);
  }

  return profiles.map((profile) => ({
    ...profile,
    email: emailById.get(profile.id) ?? null,
    memberships: membershipsByUser.get(profile.id) ?? [],
  }));
}

// Role options exposed to the create/edit operator UI.
export const OPERATOR_FORM_ROLES: readonly Role[] = ['admin', 'area_lead', 'operator'];
