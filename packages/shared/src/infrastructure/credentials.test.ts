import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  looksLikeCiphertext,
  parseCredentialsKey,
  secretsMatchConstantTime,
} from "./credentials.js";

const KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("credentials crypto", () => {
  it("round-trips secrets with AES-256-GCM", () => {
    const cipher = encryptSecret("webhook-secret-value", KEY_HEX);
    expect(looksLikeCiphertext(cipher)).toBe(true);
    expect(decryptSecret(cipher, KEY_HEX)).toBe("webhook-secret-value");
  });

  it("rejects missing or short keys", () => {
    expect(() => parseCredentialsKey("")).toThrow(/MISSING/);
    expect(() => parseCredentialsKey("too-short")).toThrow(/INVALID/);
  });

  it("fails closed on tampered ciphertext", () => {
    const cipher = encryptSecret("secret", KEY_HEX);
    const tampered = `${cipher.slice(0, -2)}aa`;
    expect(() => decryptSecret(tampered, KEY_HEX)).toThrow();
  });

  it("compares secrets in constant-time fashion", () => {
    expect(secretsMatchConstantTime("abc", "abc")).toBe(true);
    expect(secretsMatchConstantTime("abc", "abd")).toBe(false);
    expect(secretsMatchConstantTime("abc", "ab")).toBe(false);
  });
});
