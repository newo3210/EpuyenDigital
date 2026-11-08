'use server';

import { revalidatePath } from 'next/cache';
import {
  citizenProfileInputSchema,
  citizenSearchQuerySchema,
  mergeCitizensInputSchema,
  registerCitizenInputSchema,
  type CitizenSearchHit,
} from '@/contracts/citizens';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { searchCitizens } from '@/infrastructure/repositories/citizens';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { mapCitizenError } from './map-error';

const READ = ['admin', 'area_lead', 'operator', 'support'] as const;
const MUTATE = ['admin', 'area_lead', 'operator'] as const;

export type CitizenActionState = {
  status?: 'ok' | 'error';
  message?: string;
};

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function refresh(citizenId: string) {
  revalidatePath('/citizens');
  revalidatePath(`/citizens/${citizenId}`);
  revalidatePath('/inbox');
}

async function run(
  citizenId: string,
  call: () => PromiseLike<{ error: { message: string; hint?: string | null } | null }>,
): Promise<CitizenActionState> {
  const { error } = await call();
  if (error) return { status: 'error', message: mapCitizenError(error) };
  refresh(citizenId);
  return { status: 'ok', message: esAR.citizens.saved };
}

function tags(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// Search - used by the merge picker. An empty query returns no rows.
export async function searchCitizensAction(query: string): Promise<{ results: CitizenSearchHit[]; message?: string }> {
  await requirePageRole(READ);
  const parsed = citizenSearchQuerySchema.safeParse({ query });
  if (!parsed.success) return { results: [], message: esAR.citizens.errors.failed };
  if (parsed.data.query.trim() === '') return { results: [] };
  const supabase = await createServerSupabase();
  const results = await searchCitizens(supabase, parsed.data.query);
  return { results };
}

// Profile update - every saved value is marked manual inside the database function.
export async function updateCitizenProfileAction(
  _previous: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  await requirePageRole(MUTATE);
  const parsed = citizenProfileInputSchema.safeParse({
    id: readText(formData, 'id'),
    fullName: readText(formData, 'fullName'),
    documentId: readText(formData, 'documentId'),
    addressLine: readText(formData, 'addressLine'),
    neighborhood: readText(formData, 'neighborhood'),
    email: readText(formData, 'email'),
    tags: readText(formData, 'tags'),
    observations: readText(formData, 'observations'),
    partyKind: readText(formData, 'partyKind'),
    latitude: readText(formData, 'latitude'),
    longitude: readText(formData, 'longitude'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.citizens.errors.invalidField };
  const supabase = await createServerSupabase();
  return run(parsed.data.id, () =>
    supabase.rpc('update_citizen_profile', {
      p_id: parsed.data.id,
      p_full_name: parsed.data.fullName ?? null,
      p_document_id: parsed.data.documentId ?? null,
      p_address_line: parsed.data.addressLine ?? null,
      p_neighborhood: parsed.data.neighborhood ?? null,
      p_email: parsed.data.email ?? null,
      p_tags: tags(parsed.data.tags),
      p_observations: parsed.data.observations ?? null,
      p_party_kind: parsed.data.partyKind,
      p_latitude: parsed.data.latitude,
      p_longitude: parsed.data.longitude,
    }),
  );
}

// Register - the database keeps the row unregistered when a required field is empty.
export async function registerCitizenAction(
  _previous: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  await requirePageRole(MUTATE);
  const parsed = registerCitizenInputSchema.safeParse({ id: readText(formData, 'id') });
  if (!parsed.success) return { status: 'error', message: esAR.citizens.errors.failed };
  const supabase = await createServerSupabase();
  return run(parsed.data.id, () => supabase.rpc('register_citizen', { p_id: parsed.data.id }));
}

// Merge - the kept ficha stays; the dropped row remains with merged_into_id set.
export async function mergeCitizensAction(
  _previous: CitizenActionState,
  formData: FormData,
): Promise<CitizenActionState> {
  await requirePageRole(MUTATE);
  const parsed = mergeCitizensInputSchema.safeParse({
    keepId: readText(formData, 'keepId'),
    dropId: readText(formData, 'dropId'),
    note: readText(formData, 'note'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    if (issue === 'MERGE_SELF') return { status: 'error', message: esAR.citizens.errors.mergeSelf };
    return { status: 'error', message: esAR.citizens.errors.noteRequired };
  }
  const supabase = await createServerSupabase();
  return run(parsed.data.keepId, () =>
    supabase.rpc('merge_citizens', {
      p_keep: parsed.data.keepId,
      p_drop: parsed.data.dropId,
      p_note: parsed.data.note,
    }),
  );
}
