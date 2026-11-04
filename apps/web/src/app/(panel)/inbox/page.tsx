import type { Metadata } from 'next';
import { MessagesSquare } from 'lucide-react';
import { esAR } from '@/i18n/es-AR';
import { EmptyState } from '@/presentation/ui/empty-state';

export const metadata: Metadata = { title: esAR.nav.inbox };

// Inbox placeholder - empty state until the messaging change lands.
export default function InboxPage() {
  return <EmptyState icon={MessagesSquare} {...esAR.emptyStates.inbox} />;
}
