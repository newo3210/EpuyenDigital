'use client';

import { useActionState } from 'react';
import {
  acceptDelegationAction,
  claimConversationAction,
  delegateConversationAction,
  moveConversationAction,
  rejectDelegationAction,
  resolveConversationAction,
  setConversationAreaAction,
  type InboxActionState,
} from '@/features/inbox/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox;

type AreaOption = { id: string; name: string };
type OperatorOption = { id: string; fullName: string };

type ThreadActionsProps = {
  conversationId: string;
  queueColumn?: string;
  awaitingAcceptance?: boolean;
  pendingAreaId?: string | null;
  isOwner: boolean;
  isPendingTarget: boolean;
  /** Caller belongs to pending_area_id (area handoff claim-as-accept). */
  callerInPendingArea?: boolean;
  /** area_lead / admin / lead of pending area may reject area handoff. */
  canRejectAreaDelegation?: boolean;
  isAdmin?: boolean;
  areas: AreaOption[];
  operators: OperatorOption[];
};

function ActionFeedback({ state }: { state: InboxActionState }) {
  if (!state.message) return null;
  return (
    <p className={`text-sm ${state.status === 'ok' ? 'text-brand-700' : 'text-danger'}`}>
      {state.message}
    </p>
  );
}

// ThreadActions - claim / delegate / accept / reject / move / resolve / set-area.
export function ThreadActions({
  conversationId,
  queueColumn,
  awaitingAcceptance,
  pendingAreaId,
  isOwner,
  isPendingTarget,
  callerInPendingArea = false,
  canRejectAreaDelegation = false,
  isAdmin = false,
  areas,
  operators,
}: ThreadActionsProps) {
  const [claimState, claimAction, claimPending] = useActionState(claimConversationAction, {});
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptDelegationAction, {});
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectDelegationAction, {});
  const [delegateState, delegateAction, delegatePending] = useActionState(
    delegateConversationAction,
    {},
  );
  const [moveState, moveAction, movePending] = useActionState(moveConversationAction, {});
  const [resolveState, resolveAction, resolvePending] = useActionState(
    resolveConversationAction,
    {},
  );
  const [areaState, areaAction, areaPending] = useActionState(setConversationAreaAction, {});

  const areaHandoffPending = Boolean(
    awaitingAcceptance && pendingAreaId && !isPendingTarget,
  );
  const showClaim =
    queueColumn !== 'resolved' &&
    ((!isOwner && !awaitingAcceptance) || (areaHandoffPending && callerInPendingArea));
  const showAreaReject = areaHandoffPending && canRejectAreaDelegation;
  const showSetArea = (isOwner || isAdmin) && !awaitingAcceptance;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        {showClaim ? (
          <form action={claimAction}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <button
              type="submit"
              disabled={claimPending}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {copy.actions.claim}
            </button>
          </form>
        ) : null}

        {isPendingTarget ? (
          <>
            <form action={acceptAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <button
                type="submit"
                disabled={acceptPending}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {copy.actions.accept}
              </button>
            </form>
            <form action={rejectAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="conversationId" value={conversationId} />
              <input
                name="note"
                required
                placeholder={copy.actions.rejectNote}
                className="rounded-md border border-line px-2 py-1 text-sm"
              />
              <button
                type="submit"
                disabled={rejectPending}
                className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {copy.actions.reject}
              </button>
            </form>
          </>
        ) : null}

        {showAreaReject ? (
          <form action={rejectAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="conversationId" value={conversationId} />
            <input
              name="note"
              required
              placeholder={copy.actions.rejectNote}
              className="rounded-md border border-line px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={rejectPending}
              className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {copy.actions.reject}
            </button>
          </form>
        ) : null}

        {isOwner && !awaitingAcceptance ? (
          <>
            <form action={moveAction} className="flex items-center gap-2">
              <input type="hidden" name="conversationId" value={conversationId} />
              <select
                name="toColumn"
                defaultValue="in_progress"
                className="rounded-md border border-line px-2 py-1 text-sm"
              >
                <option value="claimed">{copy.columns.claimed}</option>
                <option value="in_progress">{copy.columns.in_progress}</option>
                <option value="waiting_external">{copy.columns.waiting_external}</option>
              </select>
              <button
                type="submit"
                disabled={movePending}
                className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {copy.actions.move}
              </button>
            </form>
            <form action={resolveAction}>
              <input type="hidden" name="conversationId" value={conversationId} />
              <button
                type="submit"
                disabled={resolvePending}
                className="rounded-lg border border-danger px-3 py-1.5 text-sm text-danger disabled:opacity-60"
              >
                {copy.actions.resolve}
              </button>
            </form>
          </>
        ) : null}
      </div>

      {isOwner && !awaitingAcceptance ? (
        <form action={delegateAction} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="conversationId" value={conversationId} />
          <label className="flex flex-col gap-1 text-xs">
            <span>{copy.actions.targetUser}</span>
            <select name="targetUserId" className="rounded-md border border-line px-2 py-1.5 text-sm">
              <option value="">—</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span>{copy.actions.targetArea}</span>
            <select name="targetAreaId" className="rounded-md border border-line px-2 py-1.5 text-sm">
              <option value="">—</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span>{copy.actions.delegateNote}</span>
            <input
              name="note"
              required
              className="rounded-md border border-line px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={delegatePending}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {copy.actions.delegate}
          </button>
        </form>
      ) : null}

      {showSetArea ? (
        <form action={areaAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="conversationId" value={conversationId} />
          <label className="flex flex-col gap-1 text-xs">
            <span>{copy.actions.setArea}</span>
            <select
              name="areaId"
              required
              className="rounded-md border border-line px-2 py-1.5 text-sm"
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={areaPending}
            className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {copy.actions.setArea}
          </button>
        </form>
      ) : null}

      <ActionFeedback state={claimState} />
      <ActionFeedback state={acceptState} />
      <ActionFeedback state={rejectState} />
      <ActionFeedback state={delegateState} />
      <ActionFeedback state={moveState} />
      <ActionFeedback state={resolveState} />
      <ActionFeedback state={areaState} />
    </div>
  );
}
