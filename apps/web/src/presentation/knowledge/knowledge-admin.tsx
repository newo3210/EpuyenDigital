'use client';

import { useActionState } from 'react';
import {
  reindexKnowledgeDocumentAction,
  setKnowledgeDocumentActiveAction,
  setOrgBotPausedAction,
  upsertKnowledgeDocumentAction,
  type KnowledgeActionState,
} from '@/features/knowledge/actions';
import type { KnowledgeDocumentListItem } from '@/infrastructure/repositories/knowledge';
import { esAR } from '@/i18n/es-AR';

type KnowledgeAdminProps = {
  documents: KnowledgeDocumentListItem[];
  botPaused: boolean;
};

const copy = esAR.knowledge;

// Knowledge admin - upload text docs, list index status, toggle global bot pause.
export function KnowledgeAdmin({ documents, botPaused }: KnowledgeAdminProps) {
  const [docState, docAction, docPending] = useActionState<KnowledgeActionState, FormData>(
    upsertKnowledgeDocumentAction,
    {},
  );
  const [pauseState, pauseAction, pausePending] = useActionState<KnowledgeActionState, FormData>(
    setOrgBotPausedAction,
    {},
  );
  const [toggleState, toggleAction, togglePending] = useActionState<KnowledgeActionState, FormData>(
    setKnowledgeDocumentActiveAction,
    {},
  );
  const [reindexState, reindexAction, reindexPending] = useActionState<KnowledgeActionState, FormData>(
    reindexKnowledgeDocumentAction,
    {},
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
      </header>

      <section className="flex flex-col gap-3 border-b border-line pb-6">
        <h2 className="text-lg font-semibold">{copy.pauseTitle}</h2>
        <p className="text-sm text-muted">
          {botPaused ? copy.botPausedHint : copy.botActiveHint}
        </p>
        <form action={pauseAction}>
          <input type="hidden" name="paused" value={botPaused ? 'false' : 'true'} />
          <button
            type="submit"
            disabled={pausePending}
            className="rounded bg-brand-700 px-3 py-2 text-sm text-white"
          >
            {botPaused ? copy.resumeBot : copy.pauseBot}
          </button>
        </form>
        {pauseState.message ? <p className="text-sm">{pauseState.message}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{copy.uploadTitle}</h2>
        <form action={docAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {copy.titleLabel}
            <input name="title" required className="rounded border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {copy.bodyLabel}
            <textarea name="bodyText" required rows={8} className="rounded border border-line px-2 py-1" />
          </label>
          <button
            type="submit"
            disabled={docPending}
            className="self-start rounded bg-brand-700 px-3 py-2 text-sm text-white"
          >
            {copy.save}
          </button>
        </form>
        {docState.message ? <p className="text-sm">{docState.message}</p> : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{copy.listTitle}</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="border-b border-line py-2 text-sm">
                <p className="font-medium">{doc.title}</p>
                <p className="text-muted">
                  {copy.status}: {doc.indexStatus}
                  {doc.isActive ? '' : ` · ${copy.inactive}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={toggleAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <input type="hidden" name="active" value={doc.isActive ? 'false' : 'true'} />
                    <button
                      type="submit"
                      disabled={togglePending}
                      className="rounded border border-line px-2 py-1 text-xs"
                    >
                      {doc.isActive ? copy.deactivate : copy.activate}
                    </button>
                  </form>
                  <form action={reindexAction}>
                    <input type="hidden" name="id" value={doc.id} />
                    <button
                      type="submit"
                      disabled={reindexPending}
                      className="rounded border border-line px-2 py-1 text-xs"
                    >
                      {copy.reindex}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {toggleState.message ? <p className="text-sm">{toggleState.message}</p> : null}
        {reindexState.message ? <p className="text-sm">{reindexState.message}</p> : null}
      </section>
    </div>
  );
}
