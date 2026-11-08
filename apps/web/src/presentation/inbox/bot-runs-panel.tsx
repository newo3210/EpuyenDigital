import type { BotRunListItem } from '@/infrastructure/repositories/knowledge';
import { esAR } from '@/i18n/es-AR';

type BotRunsPanelProps = {
  runs: BotRunListItem[];
};

const copy = esAR.inbox.botRuns;

// Bot runs panel - read-only decision log for the conversation thread.
export function BotRunsPanel({ runs }: BotRunsPanelProps) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{copy.title}</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-muted">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li key={run.id} className="rounded border border-line px-3 py-2 text-sm">
              <p className="font-medium">
                {run.decision}
                {run.confidence != null ? ` · ${Math.round(run.confidence * 100)}%` : ''}
                {run.handoffReason ? ` · ${run.handoffReason}` : ''}
              </p>
              {run.answer ? <p className="mt-1 whitespace-pre-wrap text-muted">{run.answer}</p> : null}
              {Array.isArray(run.sources) && run.sources.length > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  {copy.sources}:{" "}
                  {(run.sources as Array<{ title?: string; documentId?: string }>)
                    .map((source) => source.title ?? source.documentId ?? "?")
                    .join(", ")}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted">
                {new Date(run.createdAt).toLocaleString('es-AR', {
                  timeZone: 'America/Argentina/Buenos_Aires',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
