import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { esAR } from '@/i18n/es-AR';
import { ErrorStatusActions } from './error-status-actions';

// Server action mock - records the submitted id/status and returns a configurable outcome.
const { changeErrorStatusAction } = vi.hoisted(() => ({
  changeErrorStatusAction: vi.fn<(state: unknown, formData: FormData) => Promise<Record<string, unknown>>>(
    async () => ({ status: 'ok' }),
  ),
}));
vi.mock('@/features/errors/actions', () => ({ changeErrorStatusAction }));

const copy = esAR.support.errors.actions;
const ERROR_ID = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';

beforeEach(() => {
  changeErrorStatusAction.mockClear();
});

// Transitions - only moves away from the current status are offered.
describe('ErrorStatusActions - transitions', () => {
  it('offers acknowledge and resolve for an open error', () => {
    render(<ErrorStatusActions id={ERROR_ID} status="open" />);

    expect(screen.getByRole('button', { name: copy.acknowledge })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.resolve })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.reopen })).not.toBeInTheDocument();
  });

  it('offers only reopen for a resolved error', () => {
    render(<ErrorStatusActions id={ERROR_ID} status="resolved" />);

    expect(screen.getByRole('button', { name: copy.reopen })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.resolve })).not.toBeInTheDocument();
  });
});

// Submission - the action receives the incident id and the target status.
describe('ErrorStatusActions - submit', () => {
  it('sends id and target status to the server action', async () => {
    const user = userEvent.setup();
    render(<ErrorStatusActions id={ERROR_ID} status="open" />);

    await user.click(screen.getByRole('button', { name: copy.resolve }));

    await waitFor(() => expect(changeErrorStatusAction).toHaveBeenCalledTimes(1));
    const formData = changeErrorStatusAction.mock.calls[0]![1];
    expect(formData.get('id')).toBe(ERROR_ID);
    expect(formData.get('status')).toBe('resolved');
  });

  it('shows the failure message returned by the action', async () => {
    changeErrorStatusAction.mockResolvedValueOnce({ status: 'error', message: copy.failed });
    const user = userEvent.setup();
    render(<ErrorStatusActions id={ERROR_ID} status="acknowledged" />);

    await user.click(screen.getByRole('button', { name: copy.resolve }));

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.failed);
  });
});
