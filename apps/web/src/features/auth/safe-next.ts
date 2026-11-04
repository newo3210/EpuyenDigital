// Redirect defaults - panel home and the login path that must never be a post-login target.
export const DEFAULT_NEXT = '/inbox';
const LOGIN_PATH = '/login';
const PROBE_ORIGIN = 'http://next.invalid';

// Unsafe characters - backslashes (browsers read them as "/") and control characters.
const UNSAFE_CHARS = /[\\\u0000-\u001f\u007f]/;

// Post-login target - same-origin relative path or the panel home when missing or unsafe.
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || UNSAFE_CHARS.test(value)) {
    return DEFAULT_NEXT;
  }

  const url = new URL(value, PROBE_ORIGIN);
  if (url.origin !== PROBE_ORIGIN) return DEFAULT_NEXT;
  if (url.pathname === LOGIN_PATH || url.pathname.startsWith(`${LOGIN_PATH}/`)) return DEFAULT_NEXT;

  return value;
}
