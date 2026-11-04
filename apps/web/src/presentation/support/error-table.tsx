import Link from 'next/link';
import { shortCode, type ErrorLog } from '@epuyen/shared';
import type { ErrorFilters } from '@/contracts/errors';
import { esAR } from '@/i18n/es-AR';
import { STATUS_BADGE_CLASS, detailHref, formatDateTime } from './error-view-helpers';

const copy = esAR.support.errors;

// Table props - listed incidents, active filters (kept in links) and the open row id.
type ErrorTableProps = {
  errors: ErrorLog[];
  filters: ErrorFilters;
  selectedId?: string;
};

// Error table - newest first; each code links to the detail panel.
export function ErrorTable({ errors, filters, selectedId }: ErrorTableProps) {
  if (errors.length === 0) {
    return <p className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-sm text-muted">{copy.empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">{copy.columns.date}</th>
            <th scope="col" className="px-3 py-2 font-medium">{copy.columns.code}</th>
            <th scope="col" className="px-3 py-2 font-medium">{copy.columns.source}</th>
            <th scope="col" className="px-3 py-2 font-medium">{copy.columns.level}</th>
            <th scope="col" className="px-3 py-2 font-medium">{copy.columns.message}</th>
            <th scope="col" className="px-3 py-2 font-medium">{copy.columns.status}</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error) => (
            <tr
              key={error.id}
              aria-current={error.id === selectedId ? 'true' : undefined}
              className="border-b border-line last:border-0 aria-[current=true]:bg-brand-50"
            >
              <td className="tabular whitespace-nowrap px-3 py-2">{formatDateTime(error.createdAt)}</td>
              <td className="px-3 py-2">
                <Link
                  href={detailHref(filters, error.id)}
                  scroll={false}
                  className="tabular font-mono font-semibold text-brand-700 underline-offset-2 hover:underline"
                >
                  {shortCode(error.traceId)}
                </Link>
              </td>
              <td className="px-3 py-2">{copy.sources[error.source]}</td>
              <td className="px-3 py-2">{copy.levels[error.level]}</td>
              <td className="max-w-md truncate px-3 py-2" title={error.message}>
                {error.message}
              </td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASS[error.status]}`}>
                  {copy.statuses[error.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
