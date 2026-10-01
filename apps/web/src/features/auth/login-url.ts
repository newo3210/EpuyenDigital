import { safeNext } from './safe-next';

// Login query options - path to return to and lockout reason shown on the login page.
export type LockoutReason = 'inactive' | 'no_profile';
export type LoginUrlOptions = { next?: string; reason?: LockoutReason };

// Query encoding - URI-encode but keep "/" readable (e.g. /login?next=/inbox).
const encodeParam = (value: string) => encodeURIComponent(value).replace(/%2F/gi, '/');

// Login URL builder - unsafe next values are dropped instead of forwarded.
export function loginUrl(options: LoginUrlOptions = {}): string {
  const params: string[] = [];
  if (options.next && safeNext(options.next) === options.next) params.push(`next=${encodeParam(options.next)}`);
  if (options.reason) params.push(`reason=${options.reason}`);
  return params.length > 0 ? `/login?${params.join('&')}` : '/login';
}
