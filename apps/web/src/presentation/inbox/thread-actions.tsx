import type { InboxOption } from '@/contracts/inbox';
import {
  acceptDelegationAction,
  claimConversationAction,
  delegateConversationAction,
  moveConversationAction,
  resolveConversationAction,
  setConversationAreaAction,
} from '@/features/inbox/actions';
import { esAR } from '@/i18n/es-AR';
import { DelegateForm } from './delegate-form';
import { RejectForm } from './reject-form';

const copy = esAR.inbox;

type ThreadActionsProps = {
  conversationId: string;
  canMutate: boolean;
  operators: InboxOption[];
  areas: InboxOption[];
};

// Thread actions - server forms. Support renders nothing mutable.
export function ThreadActions({ conversationId, canMutate, operators, areas }: ThreadActionsProps) {
  if (!canMutate) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <form action={claimConversationAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button className="rounded border border-line px-3 py-1" type="submit">
            {copy.actions.claim}
          </button>
        </form>
        <form action={acceptDelegationAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button className="rounded border border-line px-3 py-1" type="submit">
            {copy.actions.accept}
          </button>
        </form>
        <form action={resolveConversationAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button className="rounded border border-line px-3 py-1" type="submit">
            {copy.actions.resolve}
          </button>
        </form>
      </div>

      <form action={moveConversationAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label>
          {copy.actions.move}
          <select name="column" className="ml-2 rounded border border-line bg-canvas px-2 py-1">
            <option value="claimed">{copy.columns.claimed}</option>
            <option value="in_progress">{copy.columns.in_progress}</option>
            <option value="waiting_external">{copy.columns.waiting_external}</option>
          </select>
        </label>
        <button className="rounded border border-line px-3 py-1" type="submit">
          {copy.saved}
        </button>
      </form>

      <form action={setConversationAreaAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label>
          {copy.actions.setArea}
          <select name="areaId" className="ml-2 rounded border border-line bg-canvas px-2 py-1">
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded border border-line px-3 py-1" type="submit">
          {copy.saved}
        </button>
      </form>

      <DelegateForm conversationId={conversationId} operators={operators} areas={areas} />
      <RejectForm conversationId={conversationId} />
    </section>
  );
}
