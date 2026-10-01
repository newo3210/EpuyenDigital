import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ErrorReportInput } from '@/contracts/errors';
import { esAR } from '@/i18n/es-AR';
import { ErrorFallback } from './error-fallback';

const copy = esAR.errorBoundary;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Test setup - boundary error with a server digest and a controllable report sender.
function setup(sendResult = true) {
  const error = Object.assign(new Error('render exploded'), { digest: 'digest-1' });
  const reset = vi.fn();
  const send = vi.fn<(report: ErrorReportInput) => Promise<boolean>>(async () => sendResult);
  render(<ErrorFallback error={error} reset={reset} send={send} />);
  return { reset, send, user: userEvent.setup() };
}

// Automatic report - one report per error with a fresh trace id and the server digest.
describe('ErrorFallback - automatic report', () => {
  it('reports the error once with a generated trace id', async () => {
    const { send } = setup();

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const report = send.mock.calls[0]![0];
    expect(report.traceId).toMatch(UUID_RE);
    expect(report).toMatchObject({ message: 'render exploded', digest: 'digest-1', note: undefined });
  });

  it('shows the 8-character incident code of that trace id', async () => {
    const { send } = setup();

    await waitFor(() => expect(send).toHaveBeenCalled());
    const code = send.mock.calls[0]![0].traceId.slice(0, 8).toUpperCase();
    expect(screen.getByRole('alert')).toHaveTextContent(`${copy.incidentPrefix} ${code}`);
  });
});

// Actions - retry and optional note follow-up with the same trace id.
describe('ErrorFallback - actions', () => {
  it('retries via reset', async () => {
    const { reset, user } = setup();

    await user.click(screen.getByRole('button', { name: copy.retry }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('sends the optional note with the same trace id', async () => {
    const { send, user } = setup();
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(copy.noteLabel), 'Estaba abriendo un chat');
    await user.click(screen.getByRole('button', { name: copy.sendNote }));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    const [first, second] = send.mock.calls.map(([report]) => report);
    expect(second).toMatchObject({ traceId: first!.traceId, note: 'Estaba abriendo un chat' });
    expect(await screen.findByText(copy.noteSent)).toBeInTheDocument();
  });

  it('tells the user when the note could not be sent', async () => {
    const { send, user } = setup(false);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(copy.noteLabel), 'algo');
    await user.click(screen.getByRole('button', { name: copy.sendNote }));

    expect(await screen.findByText(copy.noteFailed)).toBeInTheDocument();
  });

  it('caps the note at 500 characters', () => {
    setup();

    expect(screen.getByLabelText(copy.noteLabel)).toHaveAttribute('maxLength', '500');
  });
});
