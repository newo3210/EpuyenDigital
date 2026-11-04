import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageRole } from '@/features/auth/server';
import { loadAdminAreas } from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';
import { AreasTable } from '@/presentation/admin/areas-table';

const copy = esAR.settings.areas;

export const metadata: Metadata = { title: copy.title };

// Areas admin page - list municipal areas; admin only.
export default async function AreasSettingsPage() {
  await requirePageRole(['admin']);
  const areas = await loadAdminAreas();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
        </div>
        <Link
          href="/settings/areas/new"
          className="inline-flex items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          {copy.create}
        </Link>
      </header>

      <AreasTable areas={areas} />
    </div>
  );
}
