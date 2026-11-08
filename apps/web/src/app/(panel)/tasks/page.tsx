import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { listTasks } from '@/infrastructure/repositories/tasks';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { TaskBoard } from '@/presentation/tasks/task-board';

export const metadata: Metadata = { title: esAR.nav.tasks };

type PageProps = {
  searchParams: Promise<{ status?: string; areaId?: string }>;
};

// Tasks board - status and area filters stay server-side.
export default async function TasksPage({ searchParams }: PageProps) {
  await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const [tasks, areas] = await Promise.all([
    listTasks(supabase, {
      status: params.status || undefined,
      areaId: params.areaId || undefined,
    }),
    listAreas(supabase),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">{esAR.tasks.title}</h1>
        <p className="text-sm text-muted">{esAR.tasks.subtitle}</p>
      </header>
      <TaskBoard
        tasks={tasks}
        status={params.status}
        areaId={params.areaId}
        areas={areas.map((area) => ({ id: area.id, label: area.name }))}
      />
    </div>
  );
}
