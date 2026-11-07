'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.filters;

type AreaOption = { id: string; name: string };
type LineOption = { id: string; name: string };
type OwnerOption = { id: string; name: string };

type InboxFiltersFormProps = {
  areas: AreaOption[];
  lines: LineOption[];
  owners: OwnerOption[];
};

// InboxFiltersForm - query-string filters for the triage queue.
export function InboxFiltersForm({ areas, lines, owners }: InboxFiltersFormProps) {
  const router = useRouter();
  const params = useSearchParams();

  const onSubmit = useCallback(
    (formData: FormData) => {
      const next = new URLSearchParams();
      for (const key of [
        'areaId',
        'lineId',
        'ownerUserId',
        'awaitingMyAcceptance',
        'needsResponse',
        'hasAttachments',
      ]) {
        const value = formData.get(key);
        if (typeof value === 'string' && value.length > 0) next.set(key, value);
      }
      const qs = next.toString();
      router.push(qs ? `/inbox?${qs}` : '/inbox');
    },
    [router],
  );

  return (
    <form action={onSubmit} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold">{copy.title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span>{copy.area}</span>
          <select
            name="areaId"
            defaultValue={params.get('areaId') ?? ''}
            className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm"
          >
            <option value="">{copy.all}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span>{copy.line}</span>
          <select
            name="lineId"
            defaultValue={params.get('lineId') ?? ''}
            className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm"
          >
            <option value="">{copy.all}</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span>{copy.owner}</span>
          <select
            name="ownerUserId"
            defaultValue={params.get('ownerUserId') ?? ''}
            className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm"
          >
            <option value="">{copy.all}</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            name="awaitingMyAcceptance"
            value="1"
            defaultChecked={params.get('awaitingMyAcceptance') === '1'}
          />
          {copy.awaitingMine}
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            name="needsResponse"
            value="1"
            defaultChecked={params.get('needsResponse') === '1'}
          />
          {copy.needsResponse}
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            name="hasAttachments"
            value="1"
            defaultChecked={params.get('hasAttachments') === '1'}
          />
          {copy.hasAttachments}
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white"
        >
          {copy.apply}
        </button>
        <button
          type="button"
          onClick={() => router.push('/inbox')}
          className="rounded-lg border border-line px-3 py-1.5 text-sm"
        >
          {copy.clear}
        </button>
      </div>
    </form>
  );
}
