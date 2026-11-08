import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listNotes } from '@/infrastructure/repositories/notes';
import { getTaskDetail } from '@/infrastructure/repositories/tasks';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { NotesPanel } from '@/presentation/notes/notes-panel';
import { TaskDetailView } from '@/presentation/tasks/task-detail';

type PageProps = {
  params: Promise<{ taskId: string }>;
};

export const metadata: Metadata = { title: esAR.nav.tasks };

export default async function TaskDetailPage({ params }: PageProps) {
  const operator = await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const { taskId } = await params;
  const supabase = await createServerSupabase();
  const task = await getTaskDetail(supabase, taskId);
  if (!task) notFound();
  const notes = await listNotes(supabase, { taskId });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/tasks" className="text-sm text-brand-700 hover:underline">
        {esAR.tasks.title}
      </Link>
      <TaskDetailView
        task={task}
        canMutate={operator.role !== 'support'}
        notesSlot={
          <NotesPanel notes={notes} canMutate={operator.role !== 'support'} taskId={task.id} />
        }
      />
    </div>
  );
}
