import {
  Building2,
  Clock,
  LifeBuoy,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Phone,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';

// Nav item shape - route, label, icon and optional role allow-list (absent = every role).
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: readonly Role[];
};

// Panel sections - sidebar order; Áreas/Operadores/Líneas and Soporte are role-gated.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/inbox', label: esAR.nav.inbox, icon: MessagesSquare },
  { href: '/citizens', label: esAR.nav.citizens, icon: Users },
  { href: '/tasks', label: esAR.nav.tasks, icon: ListChecks },
  { href: '/settings/profile', label: esAR.nav.settings, icon: Settings },
  { href: '/settings/areas', label: esAR.nav.areas, icon: Building2, roles: ['admin'] },
  { href: '/settings/operators', label: esAR.nav.operators, icon: UserCog, roles: ['admin'] },
  { href: '/settings/lines', label: esAR.nav.lines, icon: Phone, roles: ['admin'] },
  { href: '/settings/quick-replies', label: esAR.nav.quickReplies, icon: MessageSquareText, roles: ['admin'] },
  { href: '/settings/hours', label: esAR.nav.hours, icon: Clock, roles: ['admin'] },
  { href: '/support/errors', label: esAR.nav.support, icon: LifeBuoy, roles: ['admin', 'support'] },
];

// Role filter - sections the given role may open.
export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
