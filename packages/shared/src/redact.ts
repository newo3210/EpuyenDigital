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
const AUTHORIZATION_LINE_RE = /\b(authorization)\s{0,10}[:=][^\n]*/gi;
const COOKIE_LINE_RE = /\b(cookie)\s{0,10}[:=][^\n]*/gi;
const BEARER_RE = /\b(bearer)\s{1,10}[^\s,;]{1,4096}/gi;
const JWT_RE = /\beyJ[\w-]{4,512}\.[\w-]{4,4096}\.[\w-]{4,512}/g;
const SUPABASE_SECRET_RE = /\bsb_secret_[\w-]{1,200}/g;
const SECRET_KEY = String.raw`[\w-]{0,40}(?:token|secret|passw(?:or)?d|key|authorization|cookie|session|credential)`;
const STRICT_SECRET_KEY = String.raw`[\w-]{0,40}(?:token|secret|passw(?:or)?d|api[_-]?key)`;
const QUOTED_VALUE = String.raw`"(?:[^"\\\n]|\\.){0,4096}"|'(?:[^'\\\n]|\\.){0,4096}'`;
const JSON_SECRET_RE = new RegExp(
  String.raw`\\?"(${SECRET_KEY})\\?"\s{0,10}:\s{0,10}(?:\\?"(?:[^"\\]|\\.){0,4096}\\?"|[^\s,}\]"]{1,4096})`,
  'gi',
);
// Single-quoted keys - objects printed by util.inspect / console.log (`{ 'x-api-key': '…' }`, D15).
const QUOTED_KEY_SECRET_RE = new RegExp(
  String.raw`'(${SECRET_KEY})'\s{0,10}:\s{0,10}(?:${QUOTED_VALUE}|[^\s,}\]]{1,4096})`,
  'gi',
);
// Bare values keep quotes (passwords may contain them). A pair is skipped only when a blank separates its
// separator from an inner strict secret pair (`missing key: token: …`), so `password=monkey:Zx91` stays whole
// (D15). An existing placeholder is never masked again.
const KEY_VALUE_SECRET_RE = new RegExp(
  String.raw`\b(${SECRET_KEY})\s{0,10}[=:](?:\s{1,10}(?!${STRICT_SECRET_KEY}\s{0,10}[=:])|)(?!\[redacted\])(?:${QUOTED_VALUE}|[^\s&,;]{1,4096})`,
  'gi',
);

// Personal data patterns - email, CUIT, DNI, Argentine phones.
// DNI: 2-3-3 grouping with one consistent separator and digit-only boundaries, so DNIs glued to letters,
// underscores, dots or digit-dot sequences match; IPs/decimals may be partially masked. Runs before phones
// so a DNI is never read as the start of a phone. A blank-separated run is left to the phone pass when a
// 4-digit group follows it after `-`/`.` (`9 294 445-1234 …`) or after a blank as the last digit group
// (`nro 12 294 445 1234`), because it is a 3-digit-area phone (D15).
// Phones: optional +54, 9, 0-prefixed area code (optionally in parentheses), 15 mobile prefix; space/dot/hyphen
// separators; last group 3-4 digits. Boundaries exclude hyphens so hyphen-joined ids are not split.
const EMAIL_RE = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){1,8}/gi;
const CUIT_RE = /(?<!\d)\d{2}-?\d{8}-?\d(?!\d)/g;
const DNI_RE =
  /(?<!\d)\d{1,2}([.\s-]?)\d{3}\1\d{3}(?!\d)(?!(?<=\s\d{3})(?:[.-]\d{4}(?!\d)|\s\d{4}(?!\d|[\s.-]\d)))/g;
const PHONE_RE =
  /(?<![\w+-])(?:\+?54[\s.-]?)?(?:9[\s.-]?)?(?:\(\s?0?\d{2,4}\s?\)|0?\d{2,4})[\s.-]?(?:15[\s.-]?)?\d{2,4}[\s.-]?\d{3,4}(?![\w-])/g;
const PHONE_MIN_DIGITS = 10;

// UUID tokens - canonical 8-4-4-4-12 hex ids (trace/row ids) exempt from the CUIT/DNI/phone passes; the literal
// hyphens anchor the token, so it is found even when glued to `_`, letters or digits (D15).
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Sensitive keys - object properties whose values are always replaced.
const SENSITIVE_KEY_RE = /passw(?:or)?d|secret|token|api[-_]?key|authorization|cookie|session|credential/i;

// Phone pass - masks candidates with enough digits; on a short candidate it resumes one character later,
// so a preceding number (`calle 123 2945 451234`) never hides the phone. Each start position begins at most
// one bounded match, so the pass stays linear.
function maskPhones(segment: string): string {
  const pattern = new RegExp(PHONE_RE.source, 'g');
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(segment)) !== null) {
    if (match[0].replace(/\D/g, '').length >= PHONE_MIN_DIGITS) {
      output += `${segment.slice(cursor, match.index)}[phone]`;
      cursor = match.index + match[0].length;
      pattern.lastIndex = cursor;
    } else {
      pattern.lastIndex = match.index + 1;
    }
  }
  return output + segment.slice(cursor);
}

// Numeric personal data - CUIT, DNI and phone passes on a segment that holds no UUID token.
function redactNumericData(segment: string): string {
  return maskPhones(segment.replace(CUIT_RE, '[cuit]').replace(DNI_RE, '[dni]'));
}

// UUID-aware pass - numeric passes run between UUID tokens; the tokens are kept verbatim.
function redactOutsideUuids(text: string): string {
  let output = '';
  let cursor = 0;
  for (const match of text.matchAll(UUID_RE)) {
    const start = match.index ?? 0;
    output += redactNumericData(text.slice(cursor, start)) + match[0];
    cursor = start + match[0].length;
  }
  return output + redactNumericData(text.slice(cursor));
}

// Text redaction - bounded input; secrets first (they may contain digits), then emails, then numeric data.
export function redactText(text: string): string {
  const bounded =
    text.length > MAX_REDACT_INPUT_CHARS ? `${text.slice(0, MAX_REDACT_INPUT_CHARS)}${TRUNCATED}` : text;
  const withoutSecrets = bounded
    .replace(AUTHORIZATION_LINE_RE, `$1: ${REDACTED}`)
    .replace(COOKIE_LINE_RE, `$1: ${REDACTED}`)
    .replace(JWT_RE, REDACTED)
    .replace(SUPABASE_SECRET_RE, REDACTED)
    .replace(BEARER_RE, `$1 ${REDACTED}`)
    .replace(JSON_SECRET_RE, `"$1":"${REDACTED}"`)
    .replace(QUOTED_KEY_SECRET_RE, `'$1': '${REDACTED}'`)
    .replace(KEY_VALUE_SECRET_RE, `$1=${REDACTED}`)
    .replace(EMAIL_RE, '[email]');
  return redactOutsideUuids(withoutSecrets);
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
