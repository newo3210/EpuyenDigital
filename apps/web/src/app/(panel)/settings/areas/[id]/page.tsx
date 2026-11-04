import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/features/auth/server';
import { loadAdminAreas } from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';
import { AreaForm } from '@/presentation/admin/area-form';

const copy = esAR.settings.areas;

export const metadata: Metadata = { title: copy.edit };

type AreaEditPageProps = {
  params: Promise<{ id: string }>;
};

// Edit area page - loads the area by id for the admin form.
export default async function EditAreaPage({ params }: AreaEditPageProps) {
  await requirePageRole(['admin']);
  const { id } = await params;
  const areas = await loadAdminAreas();
  const area = areas.find((item) => item.id === id);
  if (!area) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{copy.edit}</h1>
        <p className="mt-1 text-sm text-muted">{area.name}</p>
      </header>
      <AreaForm area={area} />
    </div>
  );
}
