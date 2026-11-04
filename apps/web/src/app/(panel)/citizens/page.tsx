import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { esAR } from '@/i18n/es-AR';
import { EmptyState } from '@/presentation/ui/empty-state';

export const metadata: Metadata = { title: esAR.nav.citizens };

// Citizens placeholder - empty state until the citizens change lands.
export default function CitizensPage() {
  return <EmptyState icon={Users} {...esAR.emptyStates.citizens} />;
}
