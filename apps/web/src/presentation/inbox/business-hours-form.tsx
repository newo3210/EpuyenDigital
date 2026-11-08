'use client';

import { useActionState } from 'react';
import { saveBusinessHoursAction, type InboxActionState } from '@/features/inbox/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.hours;
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const dayLabel: Record<(typeof days)[number], string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

type BusinessHoursFormProps = {
  hours: Record<string, [string, string][]>;
  holidays: string[];
};

// Business hours form - weekly open/close plus holiday dates for the SLA clock.
export function BusinessHoursForm({ hours, holidays }: BusinessHoursFormProps) {
  const [state, action, pending] = useActionState<InboxActionState, FormData>(saveBusinessHoursAction, {});

  return (
    <form action={action} className="mx-auto flex max-w-xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
      </header>
      {days.map((day) => {
        const window = hours[day]?.[0];
        return (
          <fieldset key={day} className="grid grid-cols-3 items-center gap-2 text-sm">
            <legend className="col-span-1">{dayLabel[day]}</legend>
            <input
              name={`${day}Open`}
              defaultValue={window?.[0] ?? ''}
              placeholder={copy.open}
              className="rounded border border-line px-2 py-1"
            />
            <input
              name={`${day}Close`}
              defaultValue={window?.[1] ?? ''}
              placeholder={copy.close}
              className="rounded border border-line px-2 py-1"
            />
          </fieldset>
        );
      })}
      <label className="flex flex-col gap-1 text-sm">
        {copy.holidays}
        <textarea name="holidays" defaultValue={holidays.join(', ')} rows={3} className="rounded border border-line px-2 py-1" />
      </label>
      {state.message ? <p className="text-sm">{state.message}</p> : null}
      <button disabled={pending} className="self-start rounded bg-brand-700 px-3 py-2 text-sm text-white" type="submit">
        {copy.save}
      </button>
    </form>
  );
}
