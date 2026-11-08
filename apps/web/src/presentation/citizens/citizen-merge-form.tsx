'use client';

import { useState } from 'react';
import type { CitizenSearchHit } from '@/contracts/citizens';
import { mergeCitizensAction, searchCitizensAction } from '@/features/citizens/actions';
import { esAR } from '@/i18n/es-AR';
import { ActionForm } from '@/presentation/inbox/action-form';

const copy = esAR.citizens;

type CitizenMergeFormProps = {
  keepId: string;
};

function label(hit: CitizenSearchHit): string {
  return hit.fullName || hit.pushName || hit.phone || hit.documentId || hit.id;
}

// Merge form - the open ficha is the record that stays.
export function CitizenMergeForm({ keepId }: CitizenMergeFormProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CitizenSearchHit[]>([]);
  const [dropId, setDropId] = useState('');

  async function lookup() {
    const response = await searchCitizensAction(query);
    setHits(response.results.filter((hit) => hit.id !== keepId));
  }

  const picked = hits.find((hit) => hit.id === dropId);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <h2 className="text-sm font-semibold">{copy.merge.title}</h2>
      <p className="text-sm text-muted">{copy.merge.hint}</p>
      <label className="flex flex-col gap-1 text-sm">
        {copy.merge.search}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2"
        />
      </label>
      <button type="button" onClick={() => void lookup()} className="w-fit text-sm text-brand-700 hover:underline">
        {copy.searchLabel}
      </button>
      {hits.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => setDropId(hit.id)} className="text-left hover:underline">
                {label(hit)}
                {hit.documentId ? ` · ${hit.documentId}` : ''}
                {hit.phone ? ` · ${hit.phone}` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ActionForm action={mergeCitizensAction} className="flex flex-col gap-2">
        <input type="hidden" name="keepId" value={keepId} />
        <input type="hidden" name="dropId" value={dropId} />
        {picked ? (
          <p className="text-sm">
            {copy.merge.picked}: {label(picked)}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          {copy.merge.note}
          <textarea name="note" required rows={2} className="w-full rounded-lg border border-line bg-surface px-3 py-2" />
        </label>
        <button type="submit" className="w-fit rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white">
          {copy.merge.submit}
        </button>
      </ActionForm>
    </section>
  );
}
