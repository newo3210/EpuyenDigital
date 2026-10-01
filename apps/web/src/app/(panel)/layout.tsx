import type { ReactNode } from 'react';
import { getCurrentOperator } from '@/features/auth/server';
import { avatarPublicUrl } from '@/infrastructure/storage/avatar-url';
import { AppShell } from '@/presentation/layout/app-shell';

// Panel layout props - every panel page renders inside the shell.
type PanelLayoutProps = {
  children: ReactNode;
};

// Panel layout - requires an active operator, then renders the shell with their identity.
export default async function PanelLayout({ children }: PanelLayoutProps) {
  const operator = await getCurrentOperator();

  return (
    <AppShell fullName={operator.fullName} role={operator.role} avatarUrl={avatarPublicUrl(operator.avatarPath)}>
      {children}
    </AppShell>
  );
}
