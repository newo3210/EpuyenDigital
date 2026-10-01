import type { Metadata } from 'next';
import { errorFiltersSchema } from '@/contracts/errors';
import { requirePageRole } from '@/features/auth/server';
import { toLogFilters } from '@/features/errors/list-errors';
import { esAR } from '@/i18n/es-AR';
import { findErrorLogById, listErrorLogs } from '@/infrastructure/repositories/error-logs';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { ErrorDetail } from '@/presentation/support/error-detail';
import { ErrorFilters } from '@/presentation/support/error-filters';
import { ErrorTable } from '@/presentation/support/error-table';

const copy = esAR.support.errors;

export const metadata: Metadata = { title: copy.title };

// Page props - Next 15 async search params (filters + open detail id).
type SupportErrorsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Support errors page - admin/support only; RLS-scoped list with filters and a detail panel.
export default async function SupportErrorsPage({ searchParams }: SupportErrorsPageProps) {
  await requirePageRole(['admin', 'support']);
  const filters = errorFiltersSchema.parse(await searchParams);
  const supabase = await createServerSupabase();

  const [errors, selected] = await Promise.all([
    listErrorLogs(supabase, toLogFilters(filters)),
    filters.id ? findErrorLogById(supabase, filters.id) : Promise.resolve(null),
  ]);
  const { id, ...activeFilters } = filters;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.subtitle}</p>
      </header>

      <ErrorFilters key={JSON.stringify(activeFilters)} initial={activeFilters} />

      <div className={id ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]' : undefined}>
        <ErrorTable errors={errors} filters={filters} selectedId={id} />
        {id && <ErrorDetail error={selected} filters={filters} />}
      </div>
    </div>
  );
}
