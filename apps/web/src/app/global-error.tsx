'use client';

import './globals.css';

import type { BoundaryError } from '@/features/errors/build-report';
import { ErrorFallback } from '@/presentation/errors/error-fallback';

// Root error boundary - replaces the root layout, so it renders its own html/body.
export default function GlobalError({ error, reset }: { error: BoundaryError; reset: () => void }) {
  return (
    <html lang="es-AR">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <main>
          <ErrorFallback error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
