'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ERROR_LEVELS, ERROR_SOURCES, ERROR_STATUSES } from '@epuyen/shared';
import type { ErrorFilters as ErrorFiltersValue } from '@/contracts/errors';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.support.errors;
const BASE_PATH = '/support/errors';

// Filter fields - query-string keys in display order (empty string means "all").
const FILTER_KEYS = ['status', 'source', 'level', 'from', 'to'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type FilterValues = Record<FilterKey, string>;

// Filters props - currently applied filters parsed from the URL.
type ErrorFiltersProps = {
  initial: Omit<ErrorFiltersValue, 'id'>;
};

// Shared field styles - compact selects and date inputs.
const FIELD_CLASS =
  'rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30';

// Error filters - edits status/source/level/date range and navigates with the new query string.
export function ErrorFilters({ initial }: ErrorFiltersProps) {
  const router = useRouter();
  const [values, setValues] = useState<FilterValues>(() => ({
    status: initial.status ?? '',
    source: initial.source ?? '',
    level: initial.level ?? '',
    from: initial.from ?? '',
    to: initial.to ?? '',
  }));

  // Field updater - one setter for every filter input.
  const update = (key: FilterKey) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  // Navigation handlers - apply builds the query from non-empty values; clear drops them all.
  const onApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) if (values[key]) params.set(key, values[key]);
    const query = params.toString();
    router.push(query ? `${BASE_PATH}?${query}` : BASE_PATH);
  };

  const onClear = () => router.push(BASE_PATH);

  return (
    <form onSubmit={onApply} aria-label={copy.filtersLabel} className="flex flex-wrap items-end gap-3">
      {/* Enum filters - status, source and level selects. */}
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.statusLabel}
        <select value={values.status} onChange={update('status')} className={FIELD_CLASS}>
          <option value="">{copy.all}</option>
          {ERROR_STATUSES.map((status) => (
            <option key={status} value={status}>
              {copy.statuses[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.sourceLabel}
        <select value={values.source} onChange={update('source')} className={FIELD_CLASS}>
          <option value="">{copy.all}</option>
          {ERROR_SOURCES.map((source) => (
            <option key={source} value={source}>
              {copy.sources[source]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.levelLabel}
        <select value={values.level} onChange={update('level')} className={FIELD_CLASS}>
          <option value="">{copy.all}</option>
          {ERROR_LEVELS.map((level) => (
            <option key={level} value={level}>
              {copy.levels[level]}
            </option>
          ))}
        </select>
      </label>

      {/* Date range - inclusive local days. */}
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.fromLabel}
        <input type="date" value={values.from} onChange={update('from')} className={FIELD_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {copy.toLabel}
        <input type="date" value={values.to} onChange={update('to')} className={FIELD_CLASS} />
      </label>

      {/* Actions - apply and clear. */}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {copy.apply}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {copy.clear}
        </button>
      </div>
    </form>
  );
}
