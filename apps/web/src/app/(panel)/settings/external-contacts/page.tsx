import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { listExternalContacts } from '@/infrastructure/repositories/tasks';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { ExternalContactsAdmin } from '@/presentation/tasks/external-contacts-admin';

export const metadata: Metadata = { title: esAR.nav.externalContacts };

export default async function ExternalContactsPage() {
  await requirePageRole(['admin']);
  const supabase = await createServerSupabase();
  const [areas, contacts] = await Promise.all([listAreas(supabase), listExternalContacts(supabase)]);

  return (
    <ExternalContactsAdmin
      areas={areas.map((area) => ({ id: area.id, label: area.name }))}
      contacts={contacts}
    />
  );
}
