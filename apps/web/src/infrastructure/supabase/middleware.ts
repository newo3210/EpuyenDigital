import { createServerClient } from '@supabase/ssr';
import type { Database } from '@epuyen/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { readPublicEnv } from '@/infrastructure/env';

// Session refresh result - response carrying refreshed cookies plus the verified user id.
export type SessionUpdate = {
  response: NextResponse;
  userId: string | null;
};

// Session refresh - validates the user with Supabase Auth and rewrites auth cookies on request and response.
// requestHeaders lets the caller forward extra headers (e.g. x-trace-id) to the route.
export async function updateSession(request: NextRequest, requestHeaders: Headers): Promise<SessionUpdate> {
  const env = readPublicEnv();
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, cacheHeaders) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) requestHeaders.set('cookie', cookieHeader);

        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  return { response, userId: data.user?.id ?? null };
}
