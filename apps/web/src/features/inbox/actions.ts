'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import {
  businessHoursSchema,
  delegateInputSchema,
  moveColumnSchema,
  quickReplySchema,
  rejectNoteSchema,
  setAreaSchema,
} from '@/contracts/inbox';
import { mapInboxError } from './map-error';

const MUTATE = ['admin', 'area_lead', 'operator'] as const;

export type InboxActionState = {
  status?: 'ok' | 'error';
  message?: string;
};

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function refresh(conversationId?: string) {
  revalidatePath('/inbox');
  if (conversationId) revalidatePath(`/inbox/${conversationId}`);
}

async function run(
  conversationId: string | undefined,
  call: () => PromiseLike<{ error: { message: string; hint?: string | null; details?: string | null } | null }>,
): Promise<InboxActionState> {
  const { error } = await call();
  if (error) return { status: 'error', message: mapInboxError(error) };
  refresh(conversationId);
  return { status: 'ok', message: esAR.inbox.saved };
}

// Claim - first operator wins; the database names the current owner on conflict.
export async function claimConversationAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(MUTATE);
  const supabase = await createServerSupabase();
  const conversationId = readText(formData, 'conversationId') ?? '';
  return run(conversationId, () => supabase.rpc('claim_conversation', { p_conversation_id: conversationId }));
}

// Delegate - person or area, note required.
export async function delegateConversationAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(MUTATE);
  const parsed = delegateInputSchema.safeParse({
    conversationId: readText(formData, 'conversationId'),
    targetUserId: readText(formData, 'targetUserId') || undefined,
    targetAreaId: readText(formData, 'targetAreaId') || undefined,
    note: readText(formData, 'note'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.inbox.errors.noteRequired };
  const supabase = await createServerSupabase();
  return run(parsed.data.conversationId, () =>
    supabase.rpc('delegate_conversation', {
      p_conversation_id: parsed.data.conversationId,
      p_target_user: parsed.data.targetUserId ?? null,
      p_target_area: parsed.data.targetAreaId ?? null,
      p_note: parsed.data.note,
    }),
  );
}

// Accept a delegation addressed to this operator or their area.
export async function acceptDelegationAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(MUTATE);
  const supabase = await createServerSupabase();
  const conversationId = readText(formData, 'conversationId') ?? '';
  return run(conversationId, () =>
    supabase.rpc('accept_conversation_delegation', { p_conversation_id: conversationId }),
  );
}

// Reject - note required, ownership returns to the delegator.
export async function rejectDelegationAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(MUTATE);
  const parsed = rejectNoteSchema.safeParse({
    conversationId: readText(formData, 'conversationId'),
    note: readText(formData, 'note'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.inbox.errors.noteRequired };
  const supabase = await createServerSupabase();
  return run(parsed.data.conversationId, () =>
    supabase.rpc('reject_conversation_delegation', {
      p_conversation_id: parsed.data.conversationId,
      p_note: parsed.data.note,
    }),
  );
}

// Move column - claimed, in progress, or waiting. Resolve is separate.
export async function moveConversationAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(MUTATE);
  const parsed = moveColumnSchema.safeParse({
    conversationId: readText(formData, 'conversationId'),
    column: readText(formData, 'column'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.inbox.errors.invalidColumn };
  const supabase = await createServerSupabase();
  return run(parsed.data.conversationId, () =>
    supabase.rpc('move_conversation', {
      p_conversation_id: parsed.data.conversationId,
      p_column: parsed.data.column,
    }),
  );
}

// Resolve - returns the bot flag to active and leaves the default queue.
export async function resolveConversationAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(MUTATE);
  const supabase = await createServerSupabase();
  const conversationId = readText(formData, 'conversationId') ?? '';
  return run(conversationId, () => supabase.rpc('resolve_conversation', { p_conversation_id: conversationId }));
}

// Manual area - does not copy coordinates and does not stop the pet job.
export async function setConversationAreaAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(MUTATE);
  const parsed = setAreaSchema.safeParse({
    conversationId: readText(formData, 'conversationId'),
    areaId: readText(formData, 'areaId'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.inbox.errors.invalidArea };
  const supabase = await createServerSupabase();
  return run(parsed.data.conversationId, () =>
    supabase.rpc('set_conversation_area', {
      p_conversation_id: parsed.data.conversationId,
      p_area_id: parsed.data.areaId,
    }),
  );
}

// Quick reply create - admin only.
export async function createQuickReplyAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin']);
  const parsed = quickReplySchema.safeParse({
    shortcut: readText(formData, 'shortcut'),
    title: readText(formData, 'title'),
    body: readText(formData, 'body'),
    areaId: readText(formData, 'areaId') || null,
  });
  if (!parsed.success) return { status: 'error', message: esAR.inbox.errors.invalidTarget };
  const supabase = await createServerSupabase();
  const { data: org } = await supabase.rpc('current_org_id');
  if (!org) return { status: 'error', message: esAR.inbox.errors.forbidden };
  const { error } = await supabase.from('quick_replies').insert({
    org_id: org,
    area_id: parsed.data.areaId,
    shortcut: parsed.data.shortcut,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  if (error) return { status: 'error', message: mapInboxError(error) };
  revalidatePath('/settings/quick-replies');
  return { status: 'ok', message: esAR.inbox.saved };
}

// Deactivate reply - keeps the row for history.
export async function deactivateQuickReplyAction(formData: FormData): Promise<void> {
  await requirePageRole(['admin']);
  const id = readText(formData, 'id');
  if (!id) return;
  const supabase = await createServerSupabase();
  await supabase.from('quick_replies').update({ is_active: false }).eq('id', id);
  revalidatePath('/settings/quick-replies');
}

// Business hours - admin edits the weekly clock and holiday dates.
export async function saveBusinessHoursAction(
  _previous: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin']);
  const day = (key: string) => {
    const open = readText(formData, `${key}Open`);
    const close = readText(formData, `${key}Close`);
    if (!open || !close) return [];
    return [[open, close] as [string, string]];
  };
  const hours = {
    mon: day('mon'),
    tue: day('tue'),
    wed: day('wed'),
    thu: day('thu'),
    fri: day('fri'),
    sat: day('sat'),
    sun: day('sun'),
  };
  const parsed = businessHoursSchema.safeParse(hours);
  if (!parsed.success) return { status: 'error', message: esAR.inbox.errors.invalidTarget };
  const holidays = (readText(formData, 'holidays') ?? '')
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('set_business_calendar', {
    p_hours: parsed.data,
    p_holidays: holidays,
  });
  if (error) return { status: 'error', message: mapInboxError(error) };
  revalidatePath('/settings/hours');
  return { status: 'ok', message: esAR.inbox.saved };
}
