import type { CitizenProfile, CitizenTimeline } from '@/contracts/citizens';
import { esAR } from '@/i18n/es-AR';
import { CitizenMergeForm } from './citizen-merge-form';
import { CitizenMissingFields } from './citizen-missing-fields';
import { CitizenProfileForm } from './citizen-profile-form';
import { CitizenRegisterForm } from './citizen-register-form';
import { CitizenTimelineView } from './citizen-timeline';

const copy = esAR.citizens;

type CitizenFichaProps = {
  profile: CitizenProfile;
  timeline: CitizenTimeline;
  canMutate: boolean;
  showTimeline?: boolean;
  showMerge?: boolean;
};

function homeLink(profile: CitizenProfile): string | null {
  if (profile.latitude == null || profile.longitude == null) return null;
  return `https://www.openstreetmap.org/?mlat=${profile.latitude}&mlon=${profile.longitude}#map=16/${profile.latitude}/${profile.longitude}`;
}

// Ficha - support sees the record and the timeline, without save, register, or merge.
export function CitizenFicha({
  profile,
  timeline,
  canMutate,
  showTimeline = true,
  showMerge = true,
}: CitizenFichaProps) {
  const map = homeLink(profile);
  const status = profile.registrationStatus === 'registered' ? copy.status.registered : copy.status.unregistered;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{profile.fullName || profile.whatsappPushName || copy.title}</h1>
        <p className="text-sm text-muted">
          {copy.partyKind[profile.partyKind]} · {status}
        </p>
        {profile.whatsappPushName ? (
          <p className="text-sm text-muted">
            {copy.pushName}: {profile.whatsappPushName}
          </p>
        ) : null}
        <p className="text-sm">
          {copy.phones}: {profile.phones.length > 0 ? profile.phones.join(', ') : copy.noPhones}
        </p>
        {map ? (
          <a href={map} className="text-sm text-brand-700 hover:underline">
            {copy.fields.home}
          </a>
        ) : null}
      </header>

      <CitizenMissingFields profile={profile} />
      {canMutate && profile.registrationStatus !== 'registered' ? <CitizenRegisterForm citizenId={profile.id} /> : null}
      {canMutate ? <CitizenProfileForm profile={profile} /> : null}
      {showTimeline ? <CitizenTimelineView timeline={timeline} /> : null}
      {canMutate && showMerge ? <CitizenMergeForm keepId={profile.id} /> : null}
    </div>
  );
}
