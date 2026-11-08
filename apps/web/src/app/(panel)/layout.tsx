import type { ReactNode } from 'react';
import { getCurrentOperator } from '@/features/auth/server';
import { countInboxAttention } from '@/infrastructure/repositories/inbox';
import { avatarPublicUrl } from '@/infrastructure/storage/avatar-url';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { AppShell } from '@/presentation/layout/app-shell';

// Panel layout props - every panel page renders inside the shell.
type PanelLayoutProps = {
  children: ReactNode;
};

// Panel layout - requires an active operator, then renders the shell with their identity.
export default async function PanelLayout({ children }: PanelLayoutProps) {
  const operator = await getCurrentOperator();
  const supabase = await createServerSupabase();
  const inboxBadge = await countInboxAttention(supabase).catch(() => 0);

  return (
    <AppShell
      fullName={operator.fullName}
      role={operator.role}
      avatarUrl={avatarPublicUrl(operator.avatarPath)}
      inboxBadge={inboxBadge}
    >
      {children}
    </AppShell>
  );
}
