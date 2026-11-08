import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { getCitizenProfile, getCitizenTimeline } from '@/infrastructure/repositories/citizens';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { CitizenFicha } from '@/presentation/citizens/citizen-ficha';

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = { title: esAR.citizens.title };

// Citizen ficha - a merged row sends the operator to the record that was kept.
export default async function CitizenPage({ params }: PageProps) {
  const operator = await requirePageRole(['admin', 'area_lead', 'operator', 'support']);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createServerSupabase();
  const profile = await getCitizenProfile(supabase, id);
  if (!profile) notFound();
  if (profile.mergedIntoId) redirect(`/citizens/${profile.mergedIntoId}`);

  const timeline = await getCitizenTimeline(supabase, profile.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/citizens" className="text-sm text-brand-700 hover:underline">
        {esAR.citizens.backToSearch}
      </Link>
      <CitizenFicha profile={profile} timeline={timeline} canMutate={operator.role !== 'support'} />
    </div>
  );
}
