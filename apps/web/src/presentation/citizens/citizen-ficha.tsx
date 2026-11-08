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

function display(value: string | null): string {
  return value && value.trim() !== '' ? value : '—';
}

// Read-only fields - support sees the ficha and has no inputs.
function CitizenProfileRead({ profile }: { profile: CitizenProfile }) {
  const rows: [string, string][] = [
    [copy.fields.fullName, display(profile.fullName)],
    [copy.fields.documentId, display(profile.documentId)],
    [copy.partyKind.label, copy.partyKind[profile.partyKind]],
    [copy.fields.addressLine, display(profile.addressLine)],
    [copy.fields.neighborhood, display(profile.neighborhood)],
    [copy.fields.email, display(profile.email)],
    [copy.fields.tags, profile.tags.length > 0 ? profile.tags.join(', ') : '—'],
    [copy.fields.observations, display(profile.observations)],
    [copy.fields.latitude, profile.latitude == null ? '—' : String(profile.latitude)],
    [copy.fields.longitude, profile.longitude == null ? '—' : String(profile.longitude)],
  ];

  return (
    <dl className="grid gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

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
      {canMutate ? <CitizenProfileForm profile={profile} /> : <CitizenProfileRead profile={profile} />}
      {showTimeline ? <CitizenTimelineView timeline={timeline} /> : null}
      {canMutate && showMerge ? <CitizenMergeForm keepId={profile.id} /> : null}
    </div>
  );
}
