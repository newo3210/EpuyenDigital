import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

// Line secrets crypto - AES-256-GCM with dedicated CREDENTIALS_ENCRYPTION_KEY (no service-role fallback)

const VERSION_PREFIX = "v1:";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class CredentialsKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialsKeyError";
  }
}

// parseCredentialsKey - 32-byte key from hex (64 chars) or base64
export function parseCredentialsKey(raw: string | undefined | null): Buffer {
  if (!raw || raw.trim().length === 0) {
    throw new CredentialsKeyError("CREDENTIALS_ENCRYPTION_KEY_MISSING");
  }
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === KEY_LENGTH) return buf;
  } catch {
    // fall through
  }
  throw new CredentialsKeyError("CREDENTIALS_ENCRYPTION_KEY_INVALID");
}

// encryptSecret - returns v1:<iv_b64>:<tag_b64>:<cipher_b64>
export function encryptSecret(plaintext: string, keyRaw: string): string {
  const key = parseCredentialsKey(keyRaw);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION_PREFIX.slice(0, -1),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

// decryptSecret - decrypts v1 ciphertext; throws on tamper/wrong key
export function decryptSecret(ciphertext: string, keyRaw: string): string {
  const key = parseCredentialsKey(keyRaw);
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new CredentialsKeyError("CIPHERTEXT_FORMAT_INVALID");
  }
  const iv = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const data = Buffer.from(parts[3]!, "base64");
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new CredentialsKeyError("CIPHERTEXT_FORMAT_INVALID");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

// secretsMatchConstantTime - compare cleartext without leaking length via early return alone
export function secretsMatchConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Still compare equal-length buffers to reduce timing signal on length branch only
    const pad = Buffer.alloc(Math.max(left.length, right.length, 1));
    timingSafeEqual(pad, pad);
    return false;
  }
  return timingSafeEqual(left, right);
}

// looksLikeCiphertext - detect v1 envelope without decrypting
export function looksLikeCiphertext(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(VERSION_PREFIX);
}
