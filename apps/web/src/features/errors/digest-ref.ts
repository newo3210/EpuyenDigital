import { createHash } from 'node:crypto';

// Reference length - hex characters kept from the SHA-256 digest.
const REF_LENGTH = 16;

// Digest reference - letters-only hash prefix; digits are avoided so DNI/phone redaction never masks it.
export function digestRef(digest: string | undefined): string | undefined {
  if (!digest) return undefined;
  const hex = createHash('sha256').update(digest).digest('hex').slice(0, REF_LENGTH);
  return [...hex].map((char) => String.fromCharCode(97 + parseInt(char, 16))).join('');
}
