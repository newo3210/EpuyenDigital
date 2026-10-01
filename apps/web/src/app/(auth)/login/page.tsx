import type { Metadata } from 'next';
import { safeNext } from '@/features/auth/safe-next';
import { esAR } from '@/i18n/es-AR';
import { LoginForm } from '@/presentation/auth/login-form';

export const metadata: Metadata = { title: esAR.auth.login.title };

// Page props - query params set by middleware (next) and requireOperator (reason).
type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }>;
};

// Lockout notices - reason codes from requireOperator mapped to es-AR copy.
const REASON_NOTICES: Record<string, string> = {
  inactive: esAR.auth.errors.inactive,
  no_profile: esAR.auth.errors.noProfile,
};

// Login page - card with the login form; unsafe next values never reach the form.
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, reason } = await searchParams;
  const safeTarget = typeof next === 'string' ? safeNext(next) : undefined;
  const notice = typeof reason === 'string' ? REASON_NOTICES[reason] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{esAR.app.organization}</p>
        <h1 className="mt-1 text-2xl font-bold">{esAR.auth.login.title}</h1>
        <p className="mt-2 mb-6 text-sm text-muted">{esAR.auth.login.subtitle}</p>
        <LoginForm next={safeTarget} notice={notice} />
      </div>
    </main>
  );
}
