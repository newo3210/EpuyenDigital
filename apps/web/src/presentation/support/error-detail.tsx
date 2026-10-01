import Link from 'next/link';
import { X } from 'lucide-react';
import { shortCode, type ErrorLog } from '@epuyen/shared';
import type { ErrorFilters } from '@/contracts/errors';
import { esAR } from '@/i18n/es-AR';
import { ErrorStatusActions } from './error-status-actions';
import { STATUS_BADGE_CLASS, closeDetailHref, formatDateTime } from './error-view-helpers';

const copy = esAR.support.errors;

// Detail props - selected incident (null when missing/purged) and filters for the close link.
type ErrorDetailProps = {
  error: ErrorLog | null;
  filters: ErrorFilters;
};

// Error detail panel - full redacted incident with status actions.
export function ErrorDetail({ error, filters }: ErrorDetailProps) {
  return (
    <aside
      aria-labelledby="error-detail-title"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 lg:sticky lg:top-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="error-detail-title" className="text-base font-semibold">
          {copy.detail.title}
          {error && <span className="tabular ml-2 font-mono text-brand-700">{shortCode(error.traceId)}</span>}
        </h2>
        <Link
          href={closeDetailHref(filters)}
          scroll={false}
          aria-label={copy.detail.close}
          className="rounded p-1 text-muted hover:bg-brand-50 hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {!error ? (
        <p className="text-sm text-muted">{copy.detail.notFound}</p>
      ) : (
        <>
          {/* Summary - message, classification and timestamps. */}
          <p className="whitespace-pre-wrap break-words text-sm">{error.message}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{copy.columns.status}</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASS[error.status]}`}>
                {copy.statuses[error.status]}
              </span>
            </dd>
            <dt className="text-muted">{copy.columns.date}</dt>
            <dd className="tabular">{formatDateTime(error.createdAt)}</dd>
            <dt className="text-muted">{copy.columns.source}</dt>
            <dd>{copy.sources[error.source]}</dd>
            <dt className="text-muted">{copy.columns.level}</dt>
            <dd>{copy.levels[error.level]}</dd>
            <dt className="text-muted">{copy.detail.traceId}</dt>
            <dd className="break-all font-mono text-xs">{error.traceId}</dd>
            <dt className="text-muted">{copy.detail.user}</dt>
            <dd className="break-all font-mono text-xs">{error.userId ?? copy.detail.noUser}</dd>
            {error.resolvedAt && (
              <>
                <dt className="text-muted">{copy.detail.resolvedAt}</dt>
                <dd className="tabular">{formatDateTime(error.resolvedAt)}</dd>
              </>
            )}
          </dl>

          {/* Technical details - redacted JSON payload. */}
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">{copy.detail.details}</h3>
            <pre className="max-h-80 overflow-auto rounded bg-canvas p-3 text-xs">
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </div>

          <ErrorStatusActions key={`${error.id}-${error.status}`} id={error.id} status={error.status} />
        </>
      )}
    </aside>
  );
}
