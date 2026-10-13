import type { ReactNode } from "react";

// Root layout - minimal HTML shell (no panel UI in this MVP)
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
