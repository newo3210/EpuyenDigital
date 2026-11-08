'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.citizens;

type CitizenSearchBoxProps = {
  initialQuery: string;
};

// Search box - waits briefly, then the server runs the database search.
export function CitizenSearchBox({ initialQuery }: CitizenSearchBoxProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    const next = value.trim();
    if (next === initialQuery.trim()) return;
    const handle = setTimeout(() => {
      const href = next ? `/citizens?q=${encodeURIComponent(next)}` : '/citizens';
      router.replace(href);
    }, 300);
    return () => clearTimeout(handle);
  }, [value, initialQuery, router]);

  return (
    <label className="flex flex-col gap-1 text-sm">
      {copy.searchLabel}
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full max-w-md rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
      />
    </label>
  );
}
