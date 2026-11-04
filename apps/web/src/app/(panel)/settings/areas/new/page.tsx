import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { AreaForm } from '@/presentation/admin/area-form';

const copy = esAR.settings.areas;

export const metadata: Metadata = { title: copy.create };

// New area page - admin create form.
export default async function NewAreaPage() {
  await requirePageRole(['admin']);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{copy.create}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
      </header>
      <AreaForm />
    </div>
  );
}
