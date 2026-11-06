import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { AreaList } from '@/presentation/areas/area-list';

export const metadata: Metadata = { title: esAR.areas.title };

// Areas settings page - admin-only municipal area management.
export default async function AreasSettingsPage() {
  await requirePageRole(['admin']);
  const supabase = await createServerSupabase();
  const areas = await listAreas(supabase);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{esAR.areas.title}</h1>
        <p className="mt-1 text-sm text-muted">{esAR.areas.subtitle}</p>
      </header>
      <AreaList areas={areas} />
    </div>
  );
}
