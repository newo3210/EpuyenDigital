import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { esAR } from '@/i18n/es-AR';
import './globals.css';

// Document metadata - "<page> · <app>" titles and description from the es-AR dictionary.
export const metadata: Metadata = {
  title: { default: esAR.app.name, template: `%s · ${esAR.app.name}` },
  description: esAR.app.description,
};

// Root layout props - every route renders inside the document body.
type RootLayoutProps = {
  children: ReactNode;
};

// Root layout - html shell with es-AR language attribute.
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es-AR">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
