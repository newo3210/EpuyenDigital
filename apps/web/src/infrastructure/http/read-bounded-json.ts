// Body cap - largest JSON body accepted by size-limited route handlers.
export const MAX_JSON_BODY_BYTES = 16384;

// Read result - parsed JSON (null when empty or malformed) or a size-limit rejection.
export type BoundedJson = { kind: 'json'; value: unknown } | { kind: 'too_large' };

// Declared size check - rejects early when content-length already exceeds the cap.
function declaresTooLarge(request: Request, maxBytes: number): boolean {
  const declared = Number(request.headers.get('content-length'));
  return Number.isFinite(declared) && declared > maxBytes;
}

// Stream reader - accumulates chunks and stops as soon as the cap is passed (no full buffering).
async function readTextWithin(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Bounded JSON reader - size-capped body read; malformed JSON becomes a null value, never a throw.
export async function readBoundedJson(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<BoundedJson> {
  if (declaresTooLarge(request, maxBytes)) return { kind: 'too_large' };

  const text = await readTextWithin(request, maxBytes);
  if (text === null) return { kind: 'too_large' };

  try {
    return { kind: 'json', value: text ? JSON.parse(text) : null };
  } catch {
    return { kind: 'json', value: null };
  }
}
