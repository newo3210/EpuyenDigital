import type { AvatarMimeType } from '@/contracts/profile';

// Detected image - real MIME type and the storage file extension for it.
export type SniffedImage = { mime: AvatarMimeType; ext: 'jpg' | 'png' | 'webp' };

// Signature check - true when the bytes at offset match the magic number.
const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);

// File signatures - JPEG SOI, PNG header, RIFF....WEBP container.
const JPEG = [0xff, 0xd8, 0xff] as const;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const RIFF = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP = [0x57, 0x45, 0x42, 0x50] as const;

// Image sniffing - trusts file content only, never the client-declared type or name.
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (startsWith(bytes, JPEG)) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(bytes, PNG)) return { mime: 'image/png', ext: 'png' };
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return { mime: 'image/webp', ext: 'webp' };
  return null;
}
