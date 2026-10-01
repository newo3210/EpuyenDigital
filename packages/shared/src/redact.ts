// Redaction limits - max nesting depth and serialized size kept for error details.
export const MAX_DETAILS_DEPTH = 5;
export const MAX_DETAILS_CHARS = 8192;

// Placeholders - fixed tokens that replace masked values.
const REDACTED = '[redacted]';
const TRUNCATED = '[truncated]';
const CIRCULAR = '[circular]';

// Secret patterns - header lines, bearer/JWT tokens and key=value credentials.
const AUTHORIZATION_LINE_RE = /\b(authorization)\s*:[^\n]*/gi;
const COOKIE_LINE_RE = /\b(cookie)\s*:[^\n]*/gi;
const BEARER_RE = /\b(bearer)\s+[^\s,;]+/gi;
const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const KEY_VALUE_SECRET_RE = /\b([\w-]*(?:token|api[_-]?key|passw(?:or)?d|secret))\s*[=:]\s*[^\s&,;]+/gi;

// Personal data patterns - email, CUIT, Argentine phones (optional +54 9), DNI (plain or dotted).
// Phone/DNI boundaries exclude hyphens so hyphen-joined ids (UUID segments) are not split.
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CUIT_RE = /(?<!\d)\d{2}-?\d{8}-?\d(?!\d)/g;
const PHONE_RE = /(?<![\w+-])(?:\+?54[\s-]?)?(?:9[\s-]?)?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{4}(?![\w-])/g;
const PHONE_MIN_DIGITS = 10;
const DNI_RE = /(?<![\d-])(?:\d{1,2}\.\d{3}\.\d{3}|\d{7,8})(?![\d-])/g;

// Sensitive keys - object properties whose values are always replaced.
const SENSITIVE_KEY_RE = /passw(?:or)?d|secret|token|api[-_]?key|authorization|cookie|session|credential/i;

// Phone replacer - masks only candidates with enough digits to be a real number.
function maskPhone(match: string): string {
  const digits = match.replace(/\D/g, '').length;
  return digits >= PHONE_MIN_DIGITS ? '[phone]' : match;
}

// Text redaction - secrets first (they may contain digits), then personal data.
export function redactText(text: string): string {
  return text
    .replace(AUTHORIZATION_LINE_RE, `$1: ${REDACTED}`)
    .replace(COOKIE_LINE_RE, `$1: ${REDACTED}`)
    .replace(JWT_RE, REDACTED)
    .replace(BEARER_RE, `$1 ${REDACTED}`)
    .replace(KEY_VALUE_SECRET_RE, `$1=${REDACTED}`)
    .replace(EMAIL_RE, '[email]')
    .replace(CUIT_RE, '[cuit]')
    .replace(PHONE_RE, maskPhone)
    .replace(DNI_RE, '[dni]');
}

// Number redaction - integers that look like DNI/CUIT/phone become their placeholder.
function redactNumber(value: number | bigint): number | bigint | string {
  const asText = String(value);
  const redacted = redactText(asText);
  return redacted === asText ? value : redacted;
}

// Recursive walker - redacts strings, masks sensitive keys, bounds depth, breaks cycles.
function redactValue(value: unknown, depth: number, ancestors: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'bigint') return redactNumber(value);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (ancestors.has(value)) return CIRCULAR;
  if (depth >= MAX_DETAILS_DEPTH) return TRUNCATED;

  ancestors.add(value);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((item) => redactValue(item, depth + 1, ancestors));
  } else {
    const source: Record<string, unknown> =
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : (value as Record<string, unknown>);
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(source)) {
      output[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : redactValue(nested, depth + 1, ancestors);
    }
    result = output;
  }
  ancestors.delete(value);
  return result;
}

// Details redaction - full walk, then size cap on the serialized result.
export function redactDetails(value: unknown): unknown {
  const redacted = redactValue(value, 0, new WeakSet());
  const serialized = JSON.stringify(redacted) ?? '';
  if (serialized.length <= MAX_DETAILS_CHARS) return redacted;
  return { truncated: true, preview: serialized.slice(0, MAX_DETAILS_CHARS) };
}
