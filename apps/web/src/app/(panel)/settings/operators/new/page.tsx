import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { loadAdminAreas } from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';
import { OperatorCreateForm } from '@/presentation/admin/operator-create-form';

const copy = esAR.settings.operators;

export const metadata: Metadata = { title: copy.create };

// New operator page - admin create form with optional area memberships.
export default async function NewOperatorPage() {
  await requirePageRole(['admin']);
  const areas = await loadAdminAreas();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{copy.create}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
      </header>
      <OperatorCreateForm areas={areas} />
    </div>
  );
}
