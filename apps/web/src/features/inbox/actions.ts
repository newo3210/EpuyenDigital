'use server';

import { revalidatePath } from 'next/cache';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import {
  acceptDelegation,
  claimConversation,
  delegateConversation,
  markConversationRead,
  moveConversation,
  rejectDelegation,
  resolveConversation,
  setConversationArea,
} from './transitions';

export type InboxActionState = {
  status?: 'ok' | 'error';
  message?: string;
};

function rpcClient(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      return { data, error };
    },
  };
}

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function conflictMessage(ownerName?: string | null): string {
  return esAR.inbox.errors.claimConflict.replace(
    '{name}',
    ownerName?.trim() || esAR.inbox.composer.errors.unknownOwner,
  );
}

async function resolveOwnerName(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  ownerUserId?: string,
): Promise<string | null> {
  if (!ownerUserId) return null;
  const { data } = await supabase.from('profiles').select('full_name').eq('id', ownerUserId).maybeSingle();
  return (data?.full_name as string | null) ?? null;
}

function revalidateInbox(conversationId?: string) {
  revalidatePath('/inbox');
  if (conversationId) revalidatePath(`/inbox/${conversationId}`);
}

export async function claimConversationAction(
  _prev: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const conversationId = readText(formData, 'conversationId');
  if (!conversationId) return { status: 'error', message: esAR.inbox.errors.missingConversation };
  const supabase = await createServerSupabase();
  const result = await claimConversation(rpcClient(supabase), conversationId);
  if (result.status === 'error') {
    const name = await resolveOwnerName(supabase, result.error.ownerUserId);
    return {
      status: 'error',
      message:
        result.error.code === 'CLAIM_CONFLICT'
          ? conflictMessage(name)
          : esAR.inbox.errors.actionFailed,
    };
  }
  revalidateInbox(conversationId);
  return { status: 'ok', message: esAR.inbox.actions.claimed };
}

export async function acceptDelegationAction(
  _prev: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const conversationId = readText(formData, 'conversationId');
  if (!conversationId) return { status: 'error', message: esAR.inbox.errors.missingConversation };
  const supabase = await createServerSupabase();
  const result = await acceptDelegation(rpcClient(supabase), conversationId);
  if (result.status === 'error') {
    return { status: 'error', message: esAR.inbox.errors.actionFailed };
  }
  revalidateInbox(conversationId);
  return { status: 'ok', message: esAR.inbox.actions.accepted };
}

export async function rejectDelegationAction(
  _prev: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const conversationId = readText(formData, 'conversationId');
  const note = readText(formData, 'note')?.trim();
  if (!conversationId) return { status: 'error', message: esAR.inbox.errors.missingConversation };
  if (!note) return { status: 'error', message: esAR.inbox.errors.noteRequired };
  const supabase = await createServerSupabase();
  const result = await rejectDelegation(rpcClient(supabase), conversationId, note);
  if (result.status === 'error') {
    return { status: 'error', message: esAR.inbox.errors.actionFailed };
  }
  revalidateInbox(conversationId);
  return { status: 'ok', message: esAR.inbox.actions.rejected };
}

export async function delegateConversationAction(
  _prev: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const conversationId = readText(formData, 'conversationId');
  const note = readText(formData, 'note')?.trim();
  const targetUserId = readText(formData, 'targetUserId') || undefined;
  const targetAreaId = readText(formData, 'targetAreaId') || undefined;
  if (!conversationId) return { status: 'error', message: esAR.inbox.errors.missingConversation };
  if (!note) return { status: 'error', message: esAR.inbox.errors.noteRequired };
  const supabase = await createServerSupabase();
  const result = await delegateConversation(rpcClient(supabase), {
    conversationId,
    targetUserId,
    targetAreaId,
    note,
  });
  if (result.status === 'error') {
    return { status: 'error', message: esAR.inbox.errors.actionFailed };
  }
  revalidateInbox(conversationId);
  return { status: 'ok', message: esAR.inbox.actions.delegated };
}

export async function moveConversationAction(
  _prev: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const conversationId = readText(formData, 'conversationId');
  const toColumn = readText(formData, 'toColumn') as
    | 'claimed'
    | 'in_progress'
    | 'waiting_external'
    | undefined;
  if (!conversationId || !toColumn) {
    return { status: 'error', message: esAR.inbox.errors.missingConversation };
  }
  const supabase = await createServerSupabase();
  const result = await moveConversation(rpcClient(supabase), conversationId, toColumn);
  if (result.status === 'error') {
    return { status: 'error', message: esAR.inbox.errors.actionFailed };
  }
  revalidateInbox(conversationId);
  return { status: 'ok', message: esAR.inbox.actions.moved };
}

export async function resolveConversationAction(
  _prev: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const conversationId = readText(formData, 'conversationId');
  if (!conversationId) return { status: 'error', message: esAR.inbox.errors.missingConversation };
  const supabase = await createServerSupabase();
  const result = await resolveConversation(rpcClient(supabase), conversationId);
  if (result.status === 'error') {
    return { status: 'error', message: esAR.inbox.errors.actionFailed };
  }
  revalidateInbox(conversationId);
  return { status: 'ok', message: esAR.inbox.actions.resolved };
}

export async function setConversationAreaAction(
  _prev: InboxActionState,
  formData: FormData,
): Promise<InboxActionState> {
  await requirePageRole(['admin', 'area_lead', 'operator']);
  const conversationId = readText(formData, 'conversationId');
  const areaId = readText(formData, 'areaId');
  if (!conversationId || !areaId) {
    return { status: 'error', message: esAR.inbox.errors.missingConversation };
  }
  const supabase = await createServerSupabase();
  const result = await setConversationArea(rpcClient(supabase), conversationId, areaId);
  if (result.status === 'error') {
    return { status: 'error', message: esAR.inbox.errors.actionFailed };
  }
  revalidateInbox(conversationId);
  return { status: 'ok', message: esAR.inbox.actions.areaChanged };
}

export async function markThreadReadAction(conversationId: string, messageId?: string | null) {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const supabase = await createServerSupabase();
  await markConversationRead(rpcClient(supabase), conversationId, messageId);
  revalidateInbox(conversationId);
}
