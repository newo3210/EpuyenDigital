import type { ReactNode } from 'react';
import type { Role } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';
import { Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

// Shell props - signed-in operator identity plus the routed page.
type AppShellProps = {
  fullName: string;
  role: Role;
  avatarUrl: string | null;
  children: ReactNode;
};

// App shell - sidebar + top bar (organization, user menu) around the page content.
export function AppShell({ fullName, role, avatarUrl, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 md:px-6">
          <span className="text-sm text-muted">{esAR.app.organization}</span>
          <UserMenu fullName={fullName} role={role} avatarUrl={avatarUrl} />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
