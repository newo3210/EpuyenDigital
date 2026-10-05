// Redaction limits - max nesting depth, serialized size kept for details, and raw text scanned per string.
export const MAX_DETAILS_DEPTH = 5;
export const MAX_DETAILS_CHARS = 8192;
export const MAX_REDACT_INPUT_CHARS = 16384;

// Placeholders - fixed tokens that replace masked values.
const REDACTED = '[redacted]';
const TRUNCATED = '[truncated]';
const CIRCULAR = '[circular]';

// Secret patterns - header lines, bearer/JWT/Supabase keys, JSON pairs and key=value credentials.
// Every quantifier is bounded so matching stays linear in the input size.
const AUTHORIZATION_LINE_RE = /\b(authorization)\s{0,10}:[^\n]*/gi;
const COOKIE_LINE_RE = /\b(cookie)\s{0,10}:[^\n]*/gi;
const BEARER_RE = /\b(bearer)\s{1,10}[^\s,;]{1,4096}/gi;
const JWT_RE = /\beyJ[\w-]{4,512}\.[\w-]{4,4096}\.[\w-]{4,512}/g;
const SUPABASE_SECRET_RE = /\bsb_secret_[\w-]{1,200}/g;
const SECRET_KEY = String.raw`[\w-]{0,40}(?:token|secret|passw(?:or)?d|key)`;
const QUOTED_VALUE = String.raw`"(?:[^"\\\n]|\\.){0,4096}"|'(?:[^'\\\n]|\\.){0,4096}'`;
const JSON_SECRET_RE = new RegExp(
  String.raw`\\?"(${SECRET_KEY})\\?"\s{0,10}:\s{0,10}(?:\\?"(?:[^"\\]|\\.){0,4096}\\?"|[^\s,}\]"]{1,4096})`,
  'gi',
);
const KEY_VALUE_SECRET_RE = new RegExp(
  String.raw`\b(${SECRET_KEY})\s{0,10}[=:]\s{0,10}(?:${QUOTED_VALUE}|["']?[^\s&,;"']{1,4096})`,
  'gi',
);

// Personal data patterns - email, CUIT, Argentine phones, DNI.
// Phones: optional +54, 9, 0-prefixed area code (optionally in parentheses), 15 mobile prefix; space/dot/hyphen separators.
// DNI: 2-3-3 grouping with one consistent separator and digit-only boundaries, so DNIs glued to letters,
// underscores or dots match while dates, dotted IPs, decimals and UUID first segments do not.
// Phone boundaries exclude hyphens so hyphen-joined ids (UUID segments) are not split.
const EMAIL_RE = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){1,8}/gi;
const CUIT_RE = /(?<!\d)\d{2}-?\d{8}-?\d(?!\d)/g;
const PHONE_RE =
  /(?<![\w+-])(?:\+?54[\s.-]?)?(?:9[\s.-]?)?(?:\(\s?0?\d{2,4}\s?\)|0?\d{2,4})[\s.-]?(?:15[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}(?![\w-])/g;
const PHONE_MIN_DIGITS = 10;
const DNI_RE = /(?<!\d|\d\.)\d{1,2}([.\s-]?)\d{3}\1\d{3}(?!\d|\.\d|-[0-9a-f]{4}-)/gi;

// Sensitive keys - object properties whose values are always replaced.
const SENSITIVE_KEY_RE = /passw(?:or)?d|secret|token|api[-_]?key|authorization|cookie|session|credential/i;

// Phone replacer - masks only candidates with enough digits to be a real number.
function maskPhone(match: string): string {
  const digits = match.replace(/\D/g, '').length;
  return digits >= PHONE_MIN_DIGITS ? '[phone]' : match;
}

// Text redaction - bounded input; secrets first (they may contain digits), then personal data.
export function redactText(text: string): string {
  const bounded =
    text.length > MAX_REDACT_INPUT_CHARS ? `${text.slice(0, MAX_REDACT_INPUT_CHARS)}${TRUNCATED}` : text;
  return bounded
    .replace(AUTHORIZATION_LINE_RE, `$1: ${REDACTED}`)
    .replace(COOKIE_LINE_RE, `$1: ${REDACTED}`)
    .replace(JWT_RE, REDACTED)
    .replace(SUPABASE_SECRET_RE, REDACTED)
    .replace(BEARER_RE, `$1 ${REDACTED}`)
    .replace(JSON_SECRET_RE, `"$1":"${REDACTED}"`)
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
