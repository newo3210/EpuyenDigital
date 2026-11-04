import { NextResponse, type NextRequest } from 'next/server';
import { TRACE_HEADER, resolveTraceId } from '@epuyen/shared';
import { PATHNAME_HEADER, resolveRouteAccess } from '@/features/auth/route-access';
import { updateSession } from '@/infrastructure/supabase/middleware';

// Request pipeline - trace id, session refresh, anonymous redirect on panel paths.
export async function middleware(request: NextRequest) {
  const traceId = resolveTraceId(request.headers.get(TRACE_HEADER));
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TRACE_HEADER, traceId);
  requestHeaders.set(PATHNAME_HEADER, `${pathname}${search}`);

  const { response, userId } = await updateSession(request, requestHeaders);
  const access = resolveRouteAccess({ pathname, search, userId });

  const result = access.type === 'redirect' ? redirectWithCookies(request, access.location, response) : response;
  result.headers.set(TRACE_HEADER, traceId);
  return result;
}

// Redirect helper - keeps refreshed/cleared auth cookies from the session update.
function redirectWithCookies(request: NextRequest, location: string, sessionResponse: NextResponse) {
  const redirect = NextResponse.redirect(new URL(location, request.url));
  for (const cookie of sessionResponse.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

// Matcher - every route except Next internals and static assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
