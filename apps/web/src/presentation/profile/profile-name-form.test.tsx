import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { esAR } from '@/i18n/es-AR';
import { ProfileNameForm } from './profile-name-form';

// Server action mock - only valid names may reach it.
const { updateNameAction } = vi.hoisted(() => ({
  updateNameAction: vi.fn<(state: unknown, formData: FormData) => Promise<Record<string, unknown>>>(async () => ({
    status: 'ok',
    message: 'Nombre actualizado.',
  })),
}));
vi.mock('@/features/profile/actions', () => ({ updateNameAction }));

const copy = esAR.profile;

beforeEach(() => {
  updateNameAction.mockClear();
});

// Name form - validates 2-80 chars client-side and confirms a successful save.
describe('ProfileNameForm', () => {
  it('starts with the current name', () => {
    render(<ProfileNameForm fullName="Ana Pérez" />);

    expect(screen.getByLabelText(copy.nameLabel)).toHaveValue('Ana Pérez');
  });

  it('rejects a 1-character name without calling the server', async () => {
    const user = userEvent.setup();
    render(<ProfileNameForm fullName="Ana Pérez" />);

    await user.clear(screen.getByLabelText(copy.nameLabel));
    await user.type(screen.getByLabelText(copy.nameLabel), 'A');
    await user.click(screen.getByRole('button', { name: copy.saveName }));

    expect(await screen.findByText(copy.errors.nameLength)).toBeInTheDocument();
    expect(updateNameAction).not.toHaveBeenCalled();
  });

  it('sends a valid name and shows the confirmation', async () => {
    const user = userEvent.setup();
    render(<ProfileNameForm fullName="Ana Pérez" />);

    await user.clear(screen.getByLabelText(copy.nameLabel));
    await user.type(screen.getByLabelText(copy.nameLabel), 'Ana María Pérez');
    await user.click(screen.getByRole('button', { name: copy.saveName }));

    await waitFor(() => expect(updateNameAction).toHaveBeenCalledTimes(1));
    expect(updateNameAction.mock.calls[0]?.[1].get('fullName')).toBe('Ana María Pérez');
    expect(await screen.findByRole('status')).toHaveTextContent(copy.nameSaved);
  });
});
