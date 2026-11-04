import type { AreaMembership, Profile } from '@epuyen/shared';
import { requireRole } from '@/features/auth/require-role';

// Listed operator - profile fields plus email and memberships for the admin table.
export type ListedOperator = {
  id: string;
  orgId: string;
  fullName: string;
  role: Profile['role'];
  isActive: boolean;
  deactivatedAt: string | null;
  email: string | null;
  memberships: AreaMembership[];
};

// List-operators ports - profiles of the org, emails from auth, memberships.
export type ListOperatorsDeps = {
  actor: Profile;
  forbidden: () => never;
  listProfiles: (orgId: string) => Promise<
    Array<{
      id: string;
      orgId: string;
      fullName: string;
      role: Profile['role'];
      isActive: boolean;
      deactivatedAt: string | null;
    }>
  >;
  resolveEmails: (userIds: string[]) => Promise<Map<string, string | null>>;
  listMemberships: () => Promise<AreaMembership[]>;
};

// List-operators use case - admin-only org directory with emails and area memberships.
export async function listOperators(deps: ListOperatorsDeps): Promise<ListedOperator[]> {
  requireRole(deps.actor, ['admin'], { forbidden: deps.forbidden });

  const profiles = await deps.listProfiles(deps.actor.orgId);
  const emails = await deps.resolveEmails(profiles.map((profile) => profile.id));
  const memberships = await deps.listMemberships();
  const byUser = new Map<string, AreaMembership[]>();
  for (const membership of memberships) {
    const list = byUser.get(membership.userId) ?? [];
    list.push(membership);
    byUser.set(membership.userId, list);
  }

  return profiles.map((profile) => ({
    id: profile.id,
    orgId: profile.orgId,
    fullName: profile.fullName,
    role: profile.role,
    isActive: profile.isActive,
    deactivatedAt: profile.deactivatedAt,
    email: emails.get(profile.id) ?? null,
    memberships: byUser.get(profile.id) ?? [],
  }));
}
