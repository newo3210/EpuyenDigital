import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { listOperators } from '@/infrastructure/repositories/operators';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { OperatorDirectory } from '@/presentation/operators/operator-directory';

export const metadata: Metadata = { title: esAR.operators.title };

// Operators settings page - admin-only directory, create, role/memberships, deactivate.
export default async function OperatorsSettingsPage() {
  await requirePageRole(['admin']);
  const supabase = await createServerSupabase();
  const [operators, areas] = await Promise.all([listOperators(supabase), listAreas(supabase)]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{esAR.operators.title}</h1>
        <p className="mt-1 text-sm text-muted">{esAR.operators.subtitle}</p>
      </header>
      <OperatorDirectory operators={operators} areas={areas} />
    </div>
  );
}
