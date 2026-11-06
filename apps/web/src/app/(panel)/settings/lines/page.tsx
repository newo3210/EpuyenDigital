import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { listWhatsappLines } from '@/infrastructure/repositories/whatsapp-lines';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { LineList } from '@/presentation/whatsapp/line-list';

export const metadata: Metadata = { title: esAR.lines.title };

// Lines settings page - admin-only Evolution WhatsApp line configuration.
export default async function LinesSettingsPage() {
  await requirePageRole(['admin']);
  const supabase = await createServerSupabase();
  // Service-role client only for secret presence booleans (REVOKE blocks user JWT).
  const admin = createAdminSupabase();
  const [lines, areas] = await Promise.all([
    listWhatsappLines(supabase, admin),
    listAreas(supabase),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{esAR.lines.title}</h1>
        <p className="mt-1 text-sm text-muted">{esAR.lines.subtitle}</p>
      </header>
      <LineList lines={lines} areas={areas} />
    </div>
  );
}
