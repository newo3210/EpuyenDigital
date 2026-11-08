import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { searchCitizens } from '@/infrastructure/repositories/citizens';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { CitizenSearchBox } from '@/presentation/citizens/citizen-search';

export const metadata: Metadata = { title: esAR.nav.citizens };

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

function hitLabel(fullName: string | null, pushName: string | null, phone: string | null): string {
  return fullName || pushName || phone || esAR.citizens.title;
}

// Citizens search - an empty query stays on the prompt and does not list the table.
export default async function CitizensPage({ searchParams }: PageProps) {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const results = query ? await searchCitizens(await createServerSupabase(), query) : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">{esAR.citizens.title}</h1>
        <p className="text-sm text-muted">{esAR.citizens.subtitle}</p>
      </header>
      <CitizenSearchBox initialQuery={query} />
      {query === '' ? (
        <p className="text-sm text-muted">{esAR.citizens.searchPrompt}</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted">{esAR.citizens.noMatches}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((hit) => (
            <li key={hit.id}>
              <Link href={`/citizens/${hit.id}`} className="block rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-brand-600">
                <span className="font-medium">{hitLabel(hit.fullName, hit.pushName, hit.phone)}</span>
                {hit.documentId ? <span className="text-muted"> · {hit.documentId}</span> : null}
                {hit.phone ? <span className="text-muted"> · {hit.phone}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
