'use client';

import { useActionState } from 'react';
import type { ExternalContact } from '@/contracts/tasks';
import type { InboxOption } from '@/contracts/inbox';
import { createTaskAction, type TaskActionState } from '@/features/tasks/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.tasks;

type CreateTaskFormProps = {
  conversationId: string;
  areas: InboxOption[];
  operators: InboxOption[];
  externalContacts: ExternalContact[];
};

// Create task - lives on the conversation thread.
export function CreateTaskForm({ conversationId, areas, operators, externalContacts }: CreateTaskFormProps) {
  const [state, formAction] = useActionState(createTaskAction, {} as TaskActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <h2 className="text-sm font-semibold">{copy.create.title}</h2>
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="flex flex-col gap-1 text-sm">
        <span>{copy.create.titleLabel}</span>
        <input name="title" required maxLength={200} className="rounded border border-line px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>{copy.create.bodyLabel}</span>
        <textarea name="body" rows={3} maxLength={4000} className="rounded border border-line px-2 py-1" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.create.kindLabel}</span>
          <select name="kind" defaultValue="other" className="rounded border border-line px-2 py-1">
            {Object.entries(copy.kind).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.create.priorityLabel}</span>
          <select name="priority" defaultValue="3" className="rounded border border-line px-2 py-1">
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.create.audienceLabel}</span>
          <select name="audience" defaultValue="self" className="rounded border border-line px-2 py-1">
            {Object.entries(copy.audience).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.create.dueLabel}</span>
          <input name="dueAt" type="datetime-local" className="rounded border border-line px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.create.areaLabel}</span>
          <select name="areaId" className="rounded border border-line px-2 py-1">
            <option value="">—</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.create.userLabel}</span>
          <select name="assignedUserId" className="rounded border border-line px-2 py-1">
            <option value="">—</option>
            {operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span>{copy.create.externalLabel}</span>
          <select name="externalContactId" className="rounded border border-line px-2 py-1">
            <option value="">—</option>
            {externalContacts
              .filter((contact) => contact.isActive)
              .map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.fullName} · {contact.phoneNormalized}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="notifyCitizenOnClose" value="on" />
        <span>{copy.create.notifyLabel}</span>
      </label>
      <button type="submit" className="self-start rounded bg-brand-700 px-3 py-1.5 text-sm text-white">
        {copy.create.submit}
      </button>
      {state.status === 'error' && state.message ? (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === 'ok' && state.message ? <p className="text-sm text-emerald-800">{state.message}</p> : null}
    </form>
  );
}
