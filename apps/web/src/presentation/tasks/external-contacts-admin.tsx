'use client';

import { useActionState } from 'react';
import type { ExternalContact } from '@/contracts/tasks';
import { upsertExternalContactAction, type TaskActionState } from '@/features/tasks/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.tasks.externalContacts;

type ExternalContactsAdminProps = {
  contacts: ExternalContact[];
  areas: { id: string; label: string }[];
};

export function ExternalContactsAdmin({ contacts, areas }: ExternalContactsAdminProps) {
  const [state, formAction] = useActionState(upsertExternalContactAction, {} as TaskActionState);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.subtitle}</p>
      </header>

      <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.fullName}</span>
          <input name="fullName" required className="rounded border border-line px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.phone}</span>
          <input name="phone" required pattern="549[0-9]+" className="rounded border border-line px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{copy.area}</span>
          <select name="areaId" required className="rounded border border-line px-2 py-1">
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" value="on" defaultChecked />
          <span>{copy.active}</span>
        </label>
        <button type="submit" className="self-start rounded bg-brand-700 px-3 py-1.5 text-sm text-white">
          {copy.save}
        </button>
        {state.status === 'error' && state.message ? (
          <p className="text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>

      {contacts.length === 0 ? (
        <p className="text-sm text-muted">{copy.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {contacts.map((contact) => (
            <li key={contact.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{contact.fullName}</p>
              <p className="text-muted">
                {contact.phoneNormalized}
                {contact.isActive ? '' : ' · off'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
