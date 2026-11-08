'use client';

import { registerCitizenAction } from '@/features/citizens/actions';
import { esAR } from '@/i18n/es-AR';
import { ActionForm } from '@/presentation/inbox/action-form';

type CitizenRegisterFormProps = {
  citizenId: string;
};

// Register - the database rejects the call when a required field is still empty.
export function CitizenRegisterForm({ citizenId }: CitizenRegisterFormProps) {
  return (
    <ActionForm action={registerCitizenAction}>
      <input type="hidden" name="id" value={citizenId} />
      <button type="submit" className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700">
        {esAR.citizens.register}
      </button>
    </ActionForm>
  );
}
