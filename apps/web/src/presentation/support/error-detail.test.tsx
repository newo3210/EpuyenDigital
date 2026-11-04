import { render, screen } from '@testing-library/react';
import type { ErrorLog } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';
import { ErrorDetail } from './error-detail';

// Server action mock - the detail panel embeds the status actions.
vi.mock('@/features/errors/actions', () => ({ changeErrorStatusAction: vi.fn(async () => ({})) }));

const copy = esAR.support.errors;

// Fixture - resolved incident with redacted details.
const ERROR: ErrorLog = {
  id: '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a',
  orgId: '7d3c1f9e-2b4a-4c8d-9e1f-0a2b3c4d5e6f',
  source: 'api',
  level: 'warn',
  message: 'Upstream timeout',
  details: { url: '/inbox', phone: '[phone]' },
  traceId: 'f3b1c2d4-0000-4000-8000-000000000001',
  userId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  status: 'resolved',
  resolvedBy: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  resolvedAt: '2026-10-01T13:00:00+00:00',
  createdAt: '2026-10-01T12:00:00+00:00',
};

// Detail panel - full incident, close link keeping filters, status actions.
describe('ErrorDetail', () => {
  it('shows the incident fields and redacted details', () => {
    render(<ErrorDetail error={ERROR} filters={{}} />);

    expect(screen.getByRole('heading', { name: new RegExp(copy.detail.title) })).toHaveTextContent('F3B1C2D4');
    expect(screen.getByText('Upstream timeout')).toBeInTheDocument();
    expect(screen.getByText(copy.sources.api)).toBeInTheDocument();
    expect(screen.getByText(copy.levels.warn)).toBeInTheDocument();
    expect(screen.getByText(ERROR.traceId)).toBeInTheDocument();
    expect(screen.getByText(/"phone": "\[phone\]"/)).toBeInTheDocument();
    expect(screen.getByText(copy.detail.resolvedAt)).toBeInTheDocument();
  });

  it('closes back to the list with the same filters', () => {
    render(<ErrorDetail error={ERROR} filters={{ level: 'warn', id: ERROR.id }} />);

    expect(screen.getByRole('link', { name: copy.detail.close })).toHaveAttribute('href', '/support/errors?level=warn');
  });

  it('offers the transitions of the current status', () => {
    render(<ErrorDetail error={ERROR} filters={{}} />);

    expect(screen.getByRole('button', { name: copy.actions.reopen })).toBeInTheDocument();
  });

  it('explains when the incident no longer exists', () => {
    render(<ErrorDetail error={null} filters={{}} />);

    expect(screen.getByText(copy.detail.notFound)).toBeInTheDocument();
  });
});
