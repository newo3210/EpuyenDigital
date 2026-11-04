import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { esAR } from '@/i18n/es-AR';
import { UserMenu } from './user-menu';

// Server action mock - logout must be triggered from the menu item.
const { signOutAction } = vi.hoisted(() => ({ signOutAction: vi.fn(async () => undefined) }));
vi.mock('@/features/auth/actions', () => ({ signOutAction }));

// User menu - shows identity and signs out from "Cerrar sesión".
describe('UserMenu', () => {
  it('shows the operator name and role', () => {
    render(<UserMenu fullName="Ana Pérez" role="operator" avatarUrl={null} />);

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText(esAR.roles.operator)).toBeInTheDocument();
  });

  it('signs out from the menu', async () => {
    const user = userEvent.setup();
    render(<UserMenu fullName="Ana Pérez" role="operator" avatarUrl={null} />);

    await user.click(screen.getByRole('button', { name: esAR.userMenu.open }));
    await user.click(await screen.findByRole('menuitem', { name: esAR.userMenu.signOut }));

    await waitFor(() => expect(signOutAction).toHaveBeenCalledTimes(1));
  });
});
