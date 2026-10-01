'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';
import { visibleNavItems } from './nav-items';

// Sidebar props - role decides which sections are listed.
type SidebarProps = {
  role: Role;
};

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// Sidebar - role-filtered panel navigation with the current section highlighted.
export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-line bg-surface md:w-60">
      <div className="flex h-16 items-center border-b border-line px-4">
        <span className="hidden text-sm font-bold leading-tight text-brand-800 md:block">{esAR.app.name}</span>
        <span aria-hidden="true" className="text-lg font-bold text-brand-800 md:hidden">
          E
        </span>
      </div>

      {/* Section links - icon-only on narrow screens, icon + label from md up. */}
      <nav aria-label={esAR.nav.label} className="flex flex-col gap-1 p-2">
        {visibleNavItems(role).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              title={label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-600 ${
                active ? 'bg-brand-50 text-brand-800' : 'text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span className="sr-only md:not-sr-only">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
