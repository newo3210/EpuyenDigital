import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { esAR } from '@/i18n/es-AR';
import { LoginForm } from './login-form';

// Server action mock - the form must only call it with valid input.
const { signInAction } = vi.hoisted(() => ({
  signInAction: vi.fn<(state: unknown, formData: FormData) => Promise<Record<string, unknown>>>(async () => ({})),
}));
vi.mock('@/features/auth/actions', () => ({ signInAction }));

const copy = esAR.auth;

// Form helpers - fill fields by their accessible labels and submit.
async function fillAndSubmit(values: { email?: string; password?: string }) {
  const user = userEvent.setup();
  if (values.email) await user.type(screen.getByLabelText(copy.login.emailLabel), values.email);
  if (values.password) await user.type(screen.getByLabelText(copy.login.passwordLabel), values.password);
  await user.click(screen.getByRole('button', { name: copy.login.submit }));
}

beforeEach(() => {
  signInAction.mockClear();
});

// Client validation - field errors are announced and no request is sent.
describe('LoginForm - validation', () => {
  it('flags both empty fields', async () => {
    render(<LoginForm />);

    await fillAndSubmit({});

    expect(await screen.findByText(copy.errors.invalidEmail)).toBeInTheDocument();
    expect(screen.getByText(copy.errors.passwordRequired)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.login.emailLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(signInAction).not.toHaveBeenCalled();
  });

  it('flags a malformed email', async () => {
    render(<LoginForm />);

    await fillAndSubmit({ email: 'ana@', password: 'secret-123' });

    expect(await screen.findByText(copy.errors.invalidEmail)).toBeInTheDocument();
    expect(signInAction).not.toHaveBeenCalled();
  });
});

// Submission - valid input reaches the server action with the safe next target.
describe('LoginForm - submit', () => {
  it('sends email, password and next to the server action', async () => {
    render(<LoginForm next="/support/errors" />);

    await fillAndSubmit({ email: 'ana@epuyen.gob.ar', password: 'secret-123' });

    await waitFor(() => expect(signInAction).toHaveBeenCalledTimes(1));
    const formData = signInAction.mock.calls[0]?.[1];
    expect(formData?.get('email')).toBe('ana@epuyen.gob.ar');
    expect(formData?.get('password')).toBe('secret-123');
    expect(formData?.get('next')).toBe('/support/errors');
  });

  it('announces the generic failure returned by the server', async () => {
    signInAction.mockResolvedValueOnce({ message: copy.errors.invalidCredentials });
    render(<LoginForm />);

    await fillAndSubmit({ email: 'ana@epuyen.gob.ar', password: 'wrong' });

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.invalidCredentials);
  });
});

// Lockout notice - reason message from requireOperator is shown on arrival.
describe('LoginForm - notice', () => {
  it('shows the lockout notice', () => {
    render(<LoginForm notice={copy.errors.inactive} />);

    expect(screen.getByRole('status')).toHaveTextContent(copy.errors.inactive);
  });
});
