import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/features/auth/server';
import { loadAdminAreas, loadAdminOperators } from '@/features/admin/actions';
import { esAR } from '@/i18n/es-AR';
import { OperatorEditForm } from '@/presentation/admin/operator-edit-form';

const copy = esAR.settings.operators;

export const metadata: Metadata = { title: copy.edit };

type OperatorEditPageProps = {
  params: Promise<{ id: string }>;
};

// Edit operator page - role/active/memberships for one operator.
export default async function EditOperatorPage({ params }: OperatorEditPageProps) {
  await requirePageRole(['admin']);
  const { id } = await params;
  const [operators, areas] = await Promise.all([loadAdminOperators(), loadAdminAreas()]);
  const operator = operators.find((item) => item.id === id);
  if (!operator) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{copy.edit}</h1>
        <p className="mt-1 text-sm text-muted">{operator.fullName}</p>
      </header>
      <OperatorEditForm operator={operator} areas={areas} />
    </div>
  );
}
