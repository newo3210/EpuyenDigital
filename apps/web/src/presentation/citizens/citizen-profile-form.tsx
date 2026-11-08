'use client';

import type { CitizenProfile } from '@/contracts/citizens';
import { updateCitizenProfileAction } from '@/features/citizens/actions';
import { esAR } from '@/i18n/es-AR';
import { ActionForm } from '@/presentation/inbox/action-form';

const copy = esAR.citizens;
const fieldClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30';

type CitizenProfileFormProps = {
  profile: CitizenProfile;
};

// Profile form - home coordinates are the citizen columns, never a message pin.
export function CitizenProfileForm({ profile }: CitizenProfileFormProps) {
  return (
    <ActionForm action={updateCitizenProfileAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={profile.id} />
      <label className="flex flex-col gap-1 text-sm">
        {copy.fields.fullName}
        <input name="fullName" defaultValue={profile.fullName ?? ''} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {copy.fields.documentId}
        <input name="documentId" defaultValue={profile.documentId ?? ''} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {copy.partyKind.label}
        <select name="partyKind" defaultValue={profile.partyKind} className={fieldClass}>
          <option value="person">{copy.partyKind.person}</option>
          <option value="organization">{copy.partyKind.organization}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {copy.fields.addressLine}
        <input name="addressLine" defaultValue={profile.addressLine ?? ''} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {copy.fields.neighborhood}
        <input name="neighborhood" defaultValue={profile.neighborhood ?? ''} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {copy.fields.email}
        <input name="email" type="email" defaultValue={profile.email ?? ''} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {copy.fields.tags}
        <input name="tags" defaultValue={profile.tags.join(', ')} className={fieldClass} />
        <span className="text-xs text-muted">{copy.fields.tagsHint}</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {copy.fields.observations}
        <textarea name="observations" defaultValue={profile.observations ?? ''} className={fieldClass} rows={3} />
      </label>
      <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">{copy.fields.home}</legend>
        <label className="flex flex-col gap-1 text-sm">
          {copy.fields.latitude}
          <input name="latitude" defaultValue={profile.latitude ?? ''} className={fieldClass} inputMode="decimal" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {copy.fields.longitude}
          <input name="longitude" defaultValue={profile.longitude ?? ''} className={fieldClass} inputMode="decimal" />
        </label>
      </fieldset>
      <button type="submit" className="w-fit rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white">
        {copy.save}
      </button>
    </ActionForm>
  );
}
