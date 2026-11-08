'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { TaskDetail } from '@/contracts/tasks';
import {
  acceptTaskAction,
  cancelTaskAction,
  claimTaskAction,
  completeTaskAction,
  rejectTaskAction,
  reopenTaskAction,
  startTaskAction,
  type TaskActionState,
} from '@/features/tasks/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.tasks;

type TaskDetailViewProps = {
  task: TaskDetail;
  canMutate: boolean;
  notesSlot?: React.ReactNode;
};

function ActionBlock({
  action,
  children,
}: {
  action: (previous: TaskActionState, formData: FormData) => Promise<TaskActionState>;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {} as TaskActionState);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded border border-line p-3 text-sm">
      {children}
      {state.status === 'error' && state.message ? (
        <p className="text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

// Task detail - support sees history without mutating controls.
export function TaskDetailView({ task, canMutate, notesSlot }: TaskDetailViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <header className="border-b border-line pb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{task.publicRef}</p>
        <h1 className="text-xl font-bold">{task.title}</h1>
        <p className="text-sm text-muted">
          {copy.status[task.status as keyof typeof copy.status] ?? task.status}
          {task.overdue ? ` · ${copy.overdue}` : ''}
        </p>
        {task.conversationId ? (
          <Link href={`/inbox/${task.conversationId}`} className="text-sm text-brand-700 hover:underline">
            {esAR.nav.inbox}
          </Link>
        ) : null}
      </header>

      {task.body ? <p className="whitespace-pre-wrap text-sm">{task.body}</p> : null}

      {canMutate ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ActionBlock action={claimTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="rounded bg-brand-700 px-3 py-1.5 text-white">
              {copy.actions.claim}
            </button>
          </ActionBlock>
          <ActionBlock action={acceptTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="rounded bg-brand-700 px-3 py-1.5 text-white">
              {copy.actions.accept}
            </button>
          </ActionBlock>
          <ActionBlock action={rejectTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <label className="flex flex-col gap-1">
              <span>{copy.actions.note}</span>
              <input name="note" required className="rounded border border-line px-2 py-1" />
            </label>
            <button type="submit" className="rounded border border-line px-3 py-1.5">
              {copy.actions.reject}
            </button>
          </ActionBlock>
          <ActionBlock action={startTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="rounded bg-brand-700 px-3 py-1.5 text-white">
              {copy.actions.start}
            </button>
          </ActionBlock>
          <ActionBlock action={completeTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <label className="flex flex-col gap-1">
              <span>{copy.actions.outcome}</span>
              <select name="outcome" className="rounded border border-line px-2 py-1" defaultValue="resolved">
                {Object.entries(copy.outcome).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded bg-brand-700 px-3 py-1.5 text-white">
              {copy.actions.complete}
            </button>
          </ActionBlock>
          <ActionBlock action={cancelTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <label className="flex flex-col gap-1">
              <span>{copy.actions.reason}</span>
              <select name="reason" className="rounded border border-line px-2 py-1" defaultValue="other">
                {Object.entries(copy.cancelReason).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>{copy.actions.reasonText}</span>
              <input name="reasonText" className="rounded border border-line px-2 py-1" />
            </label>
            <button type="submit" className="rounded border border-line px-3 py-1.5">
              {copy.actions.cancel}
            </button>
          </ActionBlock>
          <ActionBlock action={reopenTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button type="submit" className="rounded border border-line px-3 py-1.5">
              {copy.actions.reopen}
            </button>
          </ActionBlock>
        </div>
      ) : null}

      {notesSlot}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{copy.historyTitle}</h2>
        <ol className="flex flex-col gap-2">
          {task.history.map((item) => (
            <li key={item.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted">{item.event}</p>
              {item.note ? <p>{item.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
