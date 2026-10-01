import { LifeBuoy, ListChecks, MessagesSquare, Settings, Users, type LucideIcon } from 'lucide-react';
import type { Role } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';

// Nav item shape - route, label, icon and optional role allow-list (absent = every role).
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: readonly Role[];
};

// Panel sections - sidebar order; Soporte mirrors the /support/errors page guard.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/inbox', label: esAR.nav.inbox, icon: MessagesSquare },
  { href: '/citizens', label: esAR.nav.citizens, icon: Users },
  { href: '/tasks', label: esAR.nav.tasks, icon: ListChecks },
  { href: '/settings/profile', label: esAR.nav.settings, icon: Settings },
  { href: '/support/errors', label: esAR.nav.support, icon: LifeBuoy, roles: ['admin', 'support'] },
];

// Role filter - sections the given role may open.
export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
