import type { ReactNode } from 'react';
import type { Role } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';
import { InboxLive } from '@/features/inbox/inbox-live';
import { InboxSound } from '@/features/inbox/inbox-sound';
import { Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

// Shell props - signed-in operator identity plus the routed page.
type AppShellProps = {
  fullName: string;
  role: Role;
  avatarUrl: string | null;
  inboxBadge?: number;
  children: ReactNode;
};

// App shell - sidebar + top bar (organization, user menu) around the page content.
export function AppShell({ fullName, role, avatarUrl, inboxBadge = 0, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <InboxLive />
      <Sidebar role={role} inboxBadge={inboxBadge} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 md:px-6">
          <span className="text-sm text-muted">{esAR.app.organization}</span>
          <div className="flex items-center gap-3">
            <InboxSound count={inboxBadge} />
            <UserMenu fullName={fullName} role={role} avatarUrl={avatarUrl} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
