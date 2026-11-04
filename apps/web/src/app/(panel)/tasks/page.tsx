import type { Metadata } from 'next';
import { ListChecks } from 'lucide-react';
import { esAR } from '@/i18n/es-AR';
import { EmptyState } from '@/presentation/ui/empty-state';

export const metadata: Metadata = { title: esAR.nav.tasks };

// Tasks placeholder - empty state until the tasks change lands.
export default function TasksPage() {
  return <EmptyState icon={ListChecks} {...esAR.emptyStates.tasks} />;
}
