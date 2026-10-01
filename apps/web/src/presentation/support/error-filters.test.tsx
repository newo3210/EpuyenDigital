import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { esAR } from '@/i18n/es-AR';
import { ErrorFilters } from './error-filters';

// Router mock - filters navigate by pushing a new query string.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const copy = esAR.support.errors;

beforeEach(() => {
  push.mockClear();
});

// Filters form - query string reflects the chosen status, source, level and dates.
describe('ErrorFilters', () => {
  it('starts from the current filters', () => {
    render(<ErrorFilters initial={{ status: 'open', level: 'warn', from: '2026-09-01' }} />);

    expect(screen.getByLabelText(copy.statusLabel)).toHaveValue('open');
    expect(screen.getByLabelText(copy.sourceLabel)).toHaveValue('');
    expect(screen.getByLabelText(copy.levelLabel)).toHaveValue('warn');
    expect(screen.getByLabelText(copy.fromLabel)).toHaveValue('2026-09-01');
  });

  it('pushes only the chosen filters', async () => {
    const user = userEvent.setup();
    render(<ErrorFilters initial={{}} />);

    await user.selectOptions(screen.getByLabelText(copy.statusLabel), 'resolved');
    await user.selectOptions(screen.getByLabelText(copy.sourceLabel), 'web');
    fireEvent.change(screen.getByLabelText(copy.toLabel), { target: { value: '2026-09-30' } });
    await user.click(screen.getByRole('button', { name: copy.apply }));

    expect(push).toHaveBeenCalledWith('/support/errors?status=resolved&source=web&to=2026-09-30');
  });

  it('clears every filter', async () => {
    const user = userEvent.setup();
    render(<ErrorFilters initial={{ status: 'open', source: 'api' }} />);

    await user.click(screen.getByRole('button', { name: copy.clear }));

    expect(push).toHaveBeenCalledWith('/support/errors');
  });

  it('offers every status, source and level option with Spanish labels', () => {
    render(<ErrorFilters initial={{}} />);

    expect(screen.getByRole('option', { name: copy.statuses.acknowledged })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: copy.sources.db })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: copy.levels.info })).toBeInTheDocument();
  });
});
