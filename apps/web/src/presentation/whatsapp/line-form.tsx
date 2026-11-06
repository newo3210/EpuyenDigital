'use client';

import { useActionState } from 'react';
import type { Area } from '@/contracts/areas';
import type { WhatsappLine } from '@/contracts/whatsapp-lines';
import {
  createLineAction,
  testConnectionAction,
  updateLineAction,
  type LineFormState,
  type TestConnectionState,
} from '@/features/whatsapp-lines/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.lines;

type LineFormProps = {
  line?: WhatsappLine;
  areas: Area[];
};

// LineForm - admin create/edit for Evolution lines; secrets are write-only.
export function LineForm({ line, areas }: LineFormProps) {
  const action = line ? updateLineAction : createLineAction;
  const [state, formAction, pending] = useActionState<LineFormState, FormData>(action, {});
  const [testState, testAction, testPending] = useActionState<TestConnectionState, FormData>(
    testConnectionAction,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        {line ? <input type="hidden" name="id" value={line.id} /> : null}

        <Field
          label={copy.fields.name}
          name="name"
          defaultValue={line?.name}
          error={state.fieldErrors?.name}
          required
        />
        <Field
          label={copy.fields.displayPhone}
          name="displayPhone"
          defaultValue={line?.displayPhone}
          error={state.fieldErrors?.displayPhone}
          required
        />
        <Field
          label={copy.fields.evolutionBaseUrl}
          name="evolutionBaseUrl"
          defaultValue={line?.evolutionBaseUrl ?? ''}
          error={state.fieldErrors?.evolutionBaseUrl}
          required
        />
        <Field
          label={copy.fields.evolutionInstance}
          name="evolutionInstance"
          defaultValue={line?.evolutionInstance}
          error={state.fieldErrors?.evolutionInstance}
          required
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{copy.fields.defaultArea}</span>
          <select
            name="defaultAreaId"
            defaultValue={line?.defaultAreaId ?? ''}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">{copy.fields.defaultAreaEmpty}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.defaultAreaId ? (
            <span className="text-xs text-danger">{state.fieldErrors.defaultAreaId}</span>
          ) : null}
        </label>

        <Field
          label={copy.fields.apiKey}
          name="apiKey"
          type="password"
          autoComplete="new-password"
          placeholder={line?.hasApiKey ? copy.fields.secretSet : undefined}
          error={state.fieldErrors?.apiKey}
          required={!line}
        />
        <Field
          label={copy.fields.webhookSecret}
          name="webhookSecret"
          type="password"
          autoComplete="new-password"
          placeholder={line?.hasWebhookSecret ? copy.fields.secretSet : undefined}
          error={state.fieldErrors?.webhookSecret}
          required={!line}
        />

        {state.message ? (
          <p className={`text-sm ${state.status === 'ok' ? 'text-brand-700' : 'text-danger'}`}>
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? copy.saving : line ? copy.save : copy.create}
        </button>
      </form>

      {line ? (
        <form action={testAction} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <input type="hidden" name="id" value={line.id} />
          <button
            type="submit"
            disabled={testPending}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {testPending ? copy.testing : copy.testConnection}
          </button>
          <StatusBadge status={line.status} lastStatusAt={line.lastStatusAt} />
          {testState.message ? (
            <span className={`text-sm ${testState.status === 'ok' ? 'text-brand-700' : 'text-danger'}`}>
              {testState.message}
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? 'text'}
        defaultValue={props.defaultValue}
        required={props.required}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        className="rounded-lg border border-line bg-surface px-3 py-2"
      />
      {props.error ? <span className="text-xs text-danger">{props.error}</span> : null}
    </label>
  );
}

function StatusBadge({
  status,
  lastStatusAt,
}: {
  status: WhatsappLine['status'];
  lastStatusAt: string | null;
}) {
  const label = copy.status[status];
  return (
    <span className="text-sm text-muted">
      {label}
      {lastStatusAt ? ` · ${new Date(lastStatusAt).toLocaleString('es-AR')}` : ''}
    </span>
  );
}
