import { render, screen, within } from '@testing-library/react';
import type { ErrorLog } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';
import { ErrorTable } from './error-table';

const copy = esAR.support.errors;

// Fixture - one open web incident created at 12:00 UTC (09:00 in Argentina).
const ERROR: ErrorLog = {
  id: '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a',
  orgId: '7d3c1f9e-2b4a-4c8d-9e1f-0a2b3c4d5e6f',
  source: 'web',
  level: 'error',
  message: 'Render failed',
  details: {},
  traceId: 'f3b1c2d4-0000-4000-8000-000000000001',
  userId: null,
  status: 'open',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-10-01T12:00:00+00:00',
};

// Error table - rows show code, labels and status; codes link to the detail keeping filters.
describe('ErrorTable', () => {
  it('shows an empty message when there are no errors', () => {
    render(<ErrorTable errors={[]} filters={{}} />);

    expect(screen.getByText(copy.empty)).toBeInTheDocument();
  });

  it('renders one row per error with Spanish labels and Argentina time', () => {
    render(<ErrorTable errors={[ERROR]} filters={{}} />);

    const row = screen.getAllByRole('row')[1]!;
    expect(within(row).getByText('Render failed')).toBeInTheDocument();
    expect(within(row).getByText(copy.sources.web)).toBeInTheDocument();
    expect(within(row).getByText(copy.statuses.open)).toBeInTheDocument();
    expect(within(row).getByText(/\b0?9:00:00/)).toBeInTheDocument();
  });

  it('links the incident code to the detail panel keeping the active filters', () => {
    render(<ErrorTable errors={[ERROR]} filters={{ status: 'open', from: '2026-09-01' }} />);

    expect(screen.getByRole('link', { name: 'F3B1C2D4' })).toHaveAttribute(
      'href',
      `/support/errors?status=open&from=2026-09-01&id=${ERROR.id}`,
    );
  });

  it('marks the selected row', () => {
    render(<ErrorTable errors={[ERROR]} filters={{}} selectedId={ERROR.id} />);

    expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-current', 'true');
  });
});
