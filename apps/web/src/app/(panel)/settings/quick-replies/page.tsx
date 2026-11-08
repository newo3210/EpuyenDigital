import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { listAreas } from '@/infrastructure/repositories/areas';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { QuickReplyAdmin } from '@/presentation/inbox/quick-reply-admin';

export const metadata: Metadata = { title: esAR.inbox.quickReplies.title };

// Quick replies - admin catalog. Operators insert them from the composer.
export default async function QuickRepliesPage() {
  await requirePageRole(['admin']);
  const supabase = await createServerSupabase();
  const [areas, replies] = await Promise.all([
    listAreas(supabase),
    supabase.from('quick_replies').select('id, shortcut, title, body, area_id, is_active').order('title'),
  ]);

  return (
    <QuickReplyAdmin
      areas={areas.map((area) => ({ id: area.id, label: area.name }))}
      replies={(replies.data ?? []).map((row) => ({
        id: row.id,
        shortcut: row.shortcut,
        title: row.title,
        body: row.body,
        areaId: row.area_id,
        isActive: row.is_active,
      }))}
    />
  );
}
