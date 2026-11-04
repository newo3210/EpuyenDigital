import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageRole } from '@/features/auth/server';
import { loadAdminAreas, loadAdminOperators } from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';
import { OperatorsTable } from '@/presentation/admin/operators-table';

const copy = esAR.settings.operators;

export const metadata: Metadata = { title: copy.title };

// Operators admin page - list org operators; admin only.
export default async function OperatorsSettingsPage() {
  await requirePageRole(['admin']);
  const [operators, areas] = await Promise.all([loadAdminOperators(), loadAdminAreas()]);
  const areaNames = Object.fromEntries(areas.map((area) => [area.id, area.name]));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
        </div>
        <Link
          href="/settings/operators/new"
          className="inline-flex items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          {copy.create}
        </Link>
      </header>

      <OperatorsTable operators={operators} areaNames={areaNames} />
    </div>
  );
}
