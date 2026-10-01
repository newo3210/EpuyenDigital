import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Profile } from '@epuyen/shared';
import { getSessionUserId, signOutSession } from '@/infrastructure/auth/session';
import { findProfileById } from '@/infrastructure/repositories/profiles';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { requireOperator } from './require-operator';
import { PATHNAME_HEADER } from './route-access';

// Current operator - request-scoped guard; profile read with the admin client so inactive rows are visible.
export const getCurrentOperator = cache(async (): Promise<Profile> => {
  const supabase = await createServerSupabase();
  const requestHeaders = await headers();

  return requireOperator({
    currentPath: requestHeaders.get(PATHNAME_HEADER),
    getSessionUserId: () => getSessionUserId(supabase),
    findProfile: (userId) => findProfileById(createAdminSupabase(), userId),
    signOut: () => signOutSession(supabase),
    redirect,
  });
});
