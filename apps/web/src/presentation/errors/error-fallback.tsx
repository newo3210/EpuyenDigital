'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { generateTraceId, shortCode } from '@epuyen/shared';
import type { ErrorReportInput } from '@/contracts/errors';
import { buildErrorReport, type BoundaryError } from '@/features/errors/build-report';
import { sendErrorReport } from '@/infrastructure/http/error-report-client';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.errorBoundary;
const NOTE_MAX = 500;

// Fallback props - Next boundary error/reset plus an injectable sender for tests.
type ErrorFallbackProps = {
  error: BoundaryError;
  reset: () => void;
  send?: (report: ErrorReportInput) => Promise<boolean>;
};

// Note delivery state - drives the note button label and feedback message.
type NoteState = 'idle' | 'sending' | 'sent' | 'failed';

// Error fallback - reports the crash once, shows the incident code, offers retry and an optional note.
export function ErrorFallback({ error, reset, send = sendErrorReport }: ErrorFallbackProps) {
  // Incident state - one trace id per mounted boundary; reported-error guard survives StrictMode re-runs.
  const [traceId] = useState(generateTraceId);
  const reportedRef = useRef<BoundaryError | null>(null);
  const [note, setNote] = useState('');
  const [noteState, setNoteState] = useState<NoteState>('idle');

  useEffect(() => {
    if (reportedRef.current === error) return;
    reportedRef.current = error;
    void send(buildErrorReport(error, traceId, window.location.href));
  }, [error, send, traceId]);

  // Note handler - follow-up report with the same trace id and the user's note.
  const onSubmitNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!note.trim()) return;
    setNoteState('sending');
    const delivered = await send(buildErrorReport(error, traceId, window.location.href, note));
    setNoteState(delivered ? 'sent' : 'failed');
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <TriangleAlert aria-hidden="true" className="size-12 text-danger" />
      <h1 className="text-xl font-semibold">{copy.title}</h1>
      <p role="alert" className="text-sm">
        {copy.incidentPrefix} <span className="tabular font-mono font-semibold">{shortCode(traceId)}</span>
      </p>
      <p className="text-sm text-muted">{copy.hint}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {copy.retry}
      </button>

      {/* Optional note - extra context for support, linked by trace id. */}
      <form onSubmit={onSubmitNote} className="mt-4 flex w-full flex-col gap-2 text-left">
        <label htmlFor="error-note" className="text-sm font-medium">
          {copy.noteLabel}
        </label>
        <textarea
          id="error-note"
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={noteState === 'sent'}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={noteState === 'sending' || noteState === 'sent' || !note.trim()}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            {noteState === 'sending' ? copy.sendingNote : copy.sendNote}
          </button>
          {noteState === 'sent' && (
            <p role="status" className="text-sm text-brand-700">
              {copy.noteSent}
            </p>
          )}
          {noteState === 'failed' && <p className="text-sm text-danger">{copy.noteFailed}</p>}
        </div>
      </form>
    </div>
  );
}
