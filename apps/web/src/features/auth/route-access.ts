import { loginUrl } from './login-url';

// Forwarded request header - original path + query, read by server guards (requireOperator).
export const PATHNAME_HEADER = 'x-pathname';

// Public route prefixes - no session required (API handlers answer 401 themselves).
const PUBLIC_PREFIXES = ['/login', '/api'] as const;

// Access inputs and decision - request location plus verified user id.
export type RouteAccessInput = { pathname: string; search: string; userId: string | null };
export type RouteAccess = { type: 'allow' } | { type: 'redirect'; location: string };

const isPublicPath = (pathname: string) =>
  PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Middleware access rule - anonymous visitors on panel paths are sent to login with next.
export function resolveRouteAccess({ pathname, search, userId }: RouteAccessInput): RouteAccess {
  if (userId || isPublicPath(pathname)) return { type: 'allow' };
  return { type: 'redirect', location: loginUrl({ next: `${pathname}${search}` }) };
}
