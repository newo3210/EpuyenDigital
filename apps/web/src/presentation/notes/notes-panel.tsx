'use client';

import { useActionState } from 'react';
import type { NoteItem } from '@/contracts/notes';
import { convertNoteToTaskAction, createNoteAction, type NoteActionState } from '@/features/notes/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.notes;

type NotesPanelProps = {
  notes: NoteItem[];
  canMutate: boolean;
  conversationId?: string;
  citizenId?: string;
  taskId?: string;
};

// Notes panel - one-level replies and convert-to-task for open notes.
export function NotesPanel({ notes, canMutate, conversationId, citizenId, taskId }: NotesPanelProps) {
  const [createState, createAction] = useActionState(createNoteAction, {} as NoteActionState);
  const [convertState, convertAction] = useActionState(convertNoteToTaskAction, {} as NoteActionState);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <h2 className="text-sm font-semibold">{copy.title}</h2>
      {notes.length === 0 ? <p className="text-sm text-muted">{copy.empty}</p> : null}
      <ul className="flex flex-col gap-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <p className="whitespace-pre-wrap">{note.body}</p>
            <p className="mt-1 text-xs text-muted">
              {note.kind}
              {note.sealedAt ? ` · ${copy.sealed}` : ''}
            </p>
            {canMutate && !note.sealedAt && !note.parentNoteId ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={createAction} className="flex flex-1 flex-col gap-1">
                  <input type="hidden" name="parentNoteId" value={note.id} />
                  {conversationId ? <input type="hidden" name="conversationId" value={conversationId} /> : null}
                  {citizenId ? <input type="hidden" name="citizenId" value={citizenId} /> : null}
                  {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}
                  <input name="body" required placeholder={copy.reply} className="rounded border border-line px-2 py-1" />
                  <button type="submit" className="self-start text-xs text-brand-700">
                    {copy.reply}
                  </button>
                </form>
                <form action={convertAction}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <button type="submit" className="text-xs text-brand-700">
                    {copy.convert}
                  </button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {canMutate ? (
        <form action={createAction} className="flex flex-col gap-2">
          {conversationId ? <input type="hidden" name="conversationId" value={conversationId} /> : null}
          {citizenId ? <input type="hidden" name="citizenId" value={citizenId} /> : null}
          {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}
          <label className="flex flex-col gap-1 text-sm">
            <span>{copy.body}</span>
            <textarea name="body" required rows={3} className="rounded border border-line px-2 py-1" />
          </label>
          <button type="submit" className="self-start rounded bg-brand-700 px-3 py-1.5 text-sm text-white">
            {copy.submit}
          </button>
        </form>
      ) : null}

      {createState.status === 'error' && createState.message ? (
        <p className="text-sm text-red-700" role="alert">
          {createState.message}
        </p>
      ) : null}
      {convertState.status === 'ok' && convertState.message ? (
        <p className="text-sm text-emerald-800">{convertState.message}</p>
      ) : null}
    </section>
  );
}
