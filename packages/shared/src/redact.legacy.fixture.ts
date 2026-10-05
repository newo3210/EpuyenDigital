// Test-only oracle: frozen copy of redactText at commit 65eb994 (design D13 superset baseline).
// Its patterns are unbounded on purpose (as shipped then); never import this outside tests.

// Placeholder - fixed token that replaces masked secrets.
const REDACTED = '[redacted]';

// Legacy secret patterns - header lines, bearer/JWT tokens and key=value credentials.
const AUTHORIZATION_LINE_RE = /\b(authorization)\s*:[^\n]*/gi;
const COOKIE_LINE_RE = /\b(cookie)\s*:[^\n]*/gi;
const BEARER_RE = /\b(bearer)\s+[^\s,;]+/gi;
const JWT_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const KEY_VALUE_SECRET_RE = /\b([\w-]*(?:token|api[_-]?key|passw(?:or)?d|secret))\s*[=:]\s*[^\s&,;]+/gi;

// Legacy personal data patterns - email, CUIT, phones, DNI.
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CUIT_RE = /(?<!\d)\d{2}-?\d{8}-?\d(?!\d)/g;
const PHONE_RE = /(?<![\w+-])(?:\+?54[\s-]?)?(?:9[\s-]?)?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{4}(?![\w-])/g;
const PHONE_MIN_DIGITS = 10;
const DNI_RE = /(?<![\d-])(?:\d{1,2}\.\d{3}\.\d{3}|\d{7,8})(?![\d-])/g;

// Legacy phone replacer - masks only candidates with enough digits.
function maskPhone(match: string): string {
  const digits = match.replace(/\D/g, '').length;
  return digits >= PHONE_MIN_DIGITS ? '[phone]' : match;
}

// Legacy text redaction - same order as shipped in 65eb994.
export function legacyRedactText(text: string): string {
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
