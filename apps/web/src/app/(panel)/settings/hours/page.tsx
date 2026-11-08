import type { Metadata } from 'next';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { BusinessHoursForm } from '@/presentation/inbox/business-hours-form';

export const metadata: Metadata = { title: esAR.inbox.hours.title };

// Business hours - admin editor for the SLA clock.
export default async function BusinessHoursPage() {
  await requirePageRole(['admin']);
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('org_settings').select('business_hours, holidays').maybeSingle();
  const hours = (data?.business_hours ?? {}) as Record<string, [string, string][]>;
  const holidays = (data?.holidays ?? []) as string[];

  return <BusinessHoursForm hours={hours} holidays={holidays} />;
}
