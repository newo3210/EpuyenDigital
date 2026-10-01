'use client';

import type { BoundaryError } from '@/features/errors/build-report';
import { ErrorFallback } from '@/presentation/errors/error-fallback';

// Panel error boundary - keeps the shell, reports the crash and shows the incident code.
export default function PanelError({ error, reset }: { error: BoundaryError; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} />;
}
