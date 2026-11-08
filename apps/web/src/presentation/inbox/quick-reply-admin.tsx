'use client';

import { useActionState } from 'react';
import type { InboxOption } from '@/contracts/inbox';
import { createQuickReplyAction, deactivateQuickReplyAction, type InboxActionState } from '@/features/inbox/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.quickReplies;

type ReplyRow = {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  areaId: string | null;
  isActive: boolean;
};

type QuickReplyAdminProps = {
  areas: InboxOption[];
  replies: ReplyRow[];
};

// Quick reply admin - create and deactivate. Does not send WhatsApp messages.
export function QuickReplyAdmin({ areas, replies }: QuickReplyAdminProps) {
  const [state, action, pending] = useActionState<InboxActionState, FormData>(createQuickReplyAction, {});

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
      </header>
      <form action={action} className="flex flex-col gap-3 rounded-xl border border-line p-4">
        <label className="flex flex-col gap-1 text-sm">
          {copy.shortcut}
          <input name="shortcut" required className="rounded border border-line px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.name}
          <input name="title" required className="rounded border border-line px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.body}
          <textarea name="body" required rows={3} className="rounded border border-line px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.area}
          <select name="areaId" className="rounded border border-line px-2 py-1" defaultValue="">
            <option value="">{esAR.inbox.filters.all}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        {state.message ? <p className="text-sm">{state.message}</p> : null}
        <button disabled={pending} className="self-start rounded bg-brand-700 px-3 py-2 text-sm text-white" type="submit">
          {copy.save}
        </button>
      </form>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {replies.length === 0 ? <li className="p-4 text-sm text-muted">{copy.empty}</li> : null}
        {replies.map((reply) => (
          <li key={reply.id} className="flex items-start justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-medium">
                {reply.title} {!reply.isActive ? `(${copy.deactivate})` : ''}
              </p>
              <p className="text-muted">{reply.body}</p>
            </div>
            {reply.isActive ? (
              <form action={deactivateQuickReplyAction}>
                <input type="hidden" name="id" value={reply.id} />
                <button className="text-xs underline" type="submit">
                  {copy.deactivate}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
