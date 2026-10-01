'use client';

import { startTransition } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import type { Role } from '@epuyen/shared';
import { signOutAction } from '@/features/auth/actions';
import { esAR } from '@/i18n/es-AR';
import { Avatar } from '@/presentation/ui/avatar';

// Menu props - identity shown in the top bar.
type UserMenuProps = {
  fullName: string;
  role: Role;
  avatarUrl: string | null;
};

const itemClasses =
  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-brand-50';

// User menu - avatar/name trigger with profile link and sign-out.
export function UserMenu({ fullName, role, avatarUrl }: UserMenuProps) {
  // Sign-out handler - server action clears the session and redirects to /login.
  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={esAR.userMenu.open}
        className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <Avatar fullName={fullName} src={avatarUrl} size="sm" />
        <span className="hidden flex-col items-start text-left sm:flex">
          <span className="text-sm font-semibold">{fullName}</span>
          <span className="text-xs text-muted">{esAR.roles[role]}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted" />
      </DropdownMenu.Trigger>

      {/* Menu items - profile settings and sign-out. */}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          <DropdownMenu.Item asChild className={itemClasses}>
            <Link href="/settings/profile">
              <UserRound aria-hidden="true" className="size-4" />
              {esAR.userMenu.profile}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={handleSignOut} className={`${itemClasses} text-danger`}>
            <LogOut aria-hidden="true" className="size-4" />
            {esAR.userMenu.signOut}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
