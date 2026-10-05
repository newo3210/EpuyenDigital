// @vitest-environment node
import { MAX_JSON_BODY_BYTES, readBoundedJson } from './read-bounded-json';

// Request builders - JSON post with an explicit body and optional content-length override.
function post(body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/errors/report', { method: 'POST', body, headers });
}

// Streamed body - chunks without a content-length header, as chunked transfer would send.
function streamed(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request('http://localhost/api/errors/report', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
}

// Parsing - valid, malformed and empty bodies.
describe('readBoundedJson - parsing', () => {
  it('parses a valid JSON body', async () => {
    await expect(readBoundedJson(post('{"a":1}'))).resolves.toEqual({ kind: 'json', value: { a: 1 } });
  });

  it('returns a null value for malformed JSON', async () => {
    await expect(readBoundedJson(post('{nope'))).resolves.toEqual({ kind: 'json', value: null });
  });

  it('returns a null value for an empty body', async () => {
    await expect(readBoundedJson(post(null))).resolves.toEqual({ kind: 'json', value: null });
  });
});

// Size limit - declared and actual sizes above the cap are rejected without parsing.
describe('readBoundedJson - size limit', () => {
  it('rejects a declared content-length above the cap', async () => {
    const request = post('{}', { 'content-length': String(MAX_JSON_BODY_BYTES + 1) });

    await expect(readBoundedJson(request)).resolves.toEqual({ kind: 'too_large' });
  });

  it('rejects a body larger than the cap', async () => {
    const body = JSON.stringify({ message: 'x'.repeat(MAX_JSON_BODY_BYTES) });

    await expect(readBoundedJson(post(body))).resolves.toEqual({ kind: 'too_large' });
  });

  it('rejects a streamed body that grows past the cap without a content-length', async () => {
    const chunk = 'x'.repeat(4096);

    await expect(readBoundedJson(streamed(['{"m":"', chunk, chunk, chunk, chunk, chunk, '"}']))).resolves.toEqual({
      kind: 'too_large',
    });
  });

  it('accepts a body right at the cap', async () => {
    const body = JSON.stringify({ m: 'x'.repeat(MAX_JSON_BODY_BYTES - 8) });

    expect(body.length).toBe(MAX_JSON_BODY_BYTES);
    await expect(readBoundedJson(post(body))).resolves.toMatchObject({ kind: 'json' });
  });
});
