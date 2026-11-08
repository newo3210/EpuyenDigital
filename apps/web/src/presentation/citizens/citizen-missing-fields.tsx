import type { CitizenProfile } from '@/contracts/citizens';
import { citizenFieldGaps, type CitizenFieldKey } from '@/features/citizens/missing-fields';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.citizens.missing;

function labels(keys: CitizenFieldKey[]): string {
  return keys.map((key) => copy[key]).join(', ');
}

type CitizenMissingFieldsProps = {
  profile: CitizenProfile;
};

// Missing fields - required and optional lists stay separate.
export function CitizenMissingFields({ profile }: CitizenMissingFieldsProps) {
  const gaps = citizenFieldGaps({
    partyKind: profile.partyKind,
    fullName: profile.fullName,
    documentId: profile.documentId,
    phoneCount: profile.phones.length,
    addressLine: profile.addressLine,
    neighborhood: profile.neighborhood,
    email: profile.email,
  });
  if (gaps.required.length === 0 && gaps.optional.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {gaps.required.length > 0 ? (
        <p>
          <span className="font-medium">{copy.title}: </span>
          {labels(gaps.required)}
        </p>
      ) : null}
      {gaps.optional.length > 0 ? (
        <p className="text-muted">
          <span className="font-medium">{copy.optionalTitle}: </span>
          {labels(gaps.optional)}
        </p>
      ) : null}
    </div>
  );
}
