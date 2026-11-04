'use client';

import { startTransition, useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/contracts/auth';
import { signInAction, type LoginFormState } from '@/features/auth/actions';
import { esAR } from '@/i18n/es-AR';

const copy = esAR.auth.login;

// Form props - safe post-login target and lockout notice resolved by the page.
type LoginFormProps = {
  next?: string;
  notice?: string;
};

const INITIAL_STATE: LoginFormState = {};

const inputClasses =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-base outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/30 aria-invalid:border-danger';

// Login form - client validation with loginSchema, then the sign-in server action.
export function LoginForm({ next, notice }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_STATE);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  // Submit handler - only valid input reaches the server action.
  const onValid = (values: LoginInput) => {
    const formData = new FormData();
    formData.set('email', values.email);
    formData.set('password', values.password);
    if (next) formData.set('next', next);
    startTransition(() => formAction(formData));
  };

  const emailError = errors.email?.message ?? state.fieldErrors?.email;
  const passwordError = errors.password?.message ?? state.fieldErrors?.password;

  // Native action - pre-hydration submits POST to the server action, so credentials never land in a URL.
  return (
    <form action={formAction} onSubmit={handleSubmit(onValid)} noValidate className="flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}

      {/* Notices - lockout reason on arrival, generic sign-in failure after submit. */}
      {notice && (
        <p role="status" className="rounded-lg bg-notice-soft px-3 py-2 text-sm text-notice">
          {notice}
        </p>
      )}
      {state.message && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}

      {/* Credentials - labelled inputs with described field errors. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium">
          {copy.emailLabel}
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'login-email-error' : undefined}
          className={inputClasses}
          {...register('email')}
        />
        {emailError && (
          <p id="login-email-error" className="text-sm text-danger">
            {emailError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium">
          {copy.passwordLabel}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? 'login-password-error' : undefined}
          className={inputClasses}
          {...register('password')}
        />
        {passwordError && (
          <p id="login-password-error" className="text-sm text-danger">
            {passwordError}
          </p>
        )}
      </div>

      {/* Submit - disabled while the server action runs. */}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
      >
        {pending ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
