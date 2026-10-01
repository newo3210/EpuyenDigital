import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { esAR } from '@/i18n/es-AR';

// Forbidden page - rendered with HTTP 403 when requireRole calls forbidden().
export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert aria-hidden="true" className="size-12 text-danger" />
      <h1 className="text-xl font-semibold">{esAR.forbidden.title}</h1>
      <p className="max-w-md text-sm text-muted">{esAR.forbidden.description}</p>
      <Link
        href="/inbox"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {esAR.forbidden.back}
      </Link>
    </main>
  );
}
