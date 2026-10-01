import { describe, expect, it } from 'vitest';
import { MAX_DETAILS_CHARS, MAX_DETAILS_DEPTH, redactDetails, redactText } from './redact';

// Spec scenario - the exact message from error-tracking "Error with personal data".
describe('redactText - spec scenario', () => {
  it('masks DNI, phone and token in "DNI 30123456, tel 2945123456, token=abc"', () => {
    const result = redactText('DNI 30123456, tel 2945123456, token=abc');
    expect(result).not.toContain('30123456');
    expect(result).not.toContain('2945123456');
    expect(result).not.toContain('abc');
    expect(result).toBe('DNI [dni], tel [phone], token=[redacted]');
  });
});

// Personal data - DNI, CUIT, Argentine phones, emails.
describe('redactText - personal data', () => {
  it('masks 7 and 8 digit DNI numbers', () => {
    expect(redactText('dni 30123456 y 5123456')).toBe('dni [dni] y [dni]');
  });

  it('masks DNI written with dots', () => {
    expect(redactText('DNI 30.123.456.')).toBe('DNI [dni].');
  });

  it('masks CUIT with and without dashes', () => {
    expect(redactText('cuit 20-30123456-7 o 20301234567')).toBe('cuit [cuit] o [cuit]');
  });

  it('masks 10-digit local phones with and without separators', () => {
    expect(redactText('tel 2945123456')).toBe('tel [phone]');
    expect(redactText('tel 2945 123456')).toBe('tel [phone]');
    expect(redactText('tel 11-5555-6677')).toBe('tel [phone]');
  });

  it('masks international phones with +54 9 prefix', () => {
    expect(redactText('wa +54 9 2945 123456 ok')).toBe('wa [phone] ok');
    expect(redactText('wa +5492945123456')).toBe('wa [phone]');
    expect(redactText('wa 5492945123456')).toBe('wa [phone]');
  });

  it('masks a phone and a DNI separated only by a space', () => {
    const result = redactText('30123456 2945123456');
    expect(result).not.toMatch(/\d{7,}/);
  });

  it('masks emails', () => {
    expect(redactText('mail Ana.Perez+x@epuyen.gob.ar listo')).toBe('mail [email] listo');
  });

  it('keeps short numbers and plain text untouched', () => {
    expect(redactText('Error 500 en paso 3 de 12')).toBe('Error 500 en paso 3 de 12');
  });

  it('does not mistake timestamps or UUIDs for phones', () => {
    const text = 'at 2026-10-01 12:30:45 trace 550e8400-e29b-41d4-a716-446655440000';
    expect(redactText(text)).toBe(text);
  });
});

// Secrets - tokens, api keys, bearer, authorization, passwords, cookies, JWTs.
describe('redactText - secrets', () => {
  it('masks token= and apikey= values', () => {
    expect(redactText('url?token=abc123&apikey=XYZ-987&page=2')).toBe(
      'url?token=[redacted]&apikey=[redacted]&page=2',
    );
  });

  it('masks key: value forms case-insensitively', () => {
    expect(redactText('API_KEY: s3cr3t PASSWORD= hunter2')).toBe('API_KEY=[redacted] PASSWORD=[redacted]');
  });

  it('masks bearer tokens', () => {
    expect(redactText('sent Bearer abc.def.ghi to api')).toBe('sent Bearer [redacted] to api');
  });

  it('masks the whole authorization header line', () => {
    const result = redactText('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig\nnext line');
    expect(result).toBe('Authorization: [redacted]\nnext line');
  });

  it('masks cookie header lines', () => {
    expect(redactText('Cookie: sb-access-token=abc; other=1')).toBe('Cookie: [redacted]');
  });

  it('masks bare JWTs', () => {
    expect(redactText('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl end')).toBe('jwt [redacted] end');
  });
});

// Structured details - recursion, sensitive keys, depth and size limits.
describe('redactDetails', () => {
  it('redacts strings inside nested objects and arrays', () => {
    const result = redactDetails({
      citizen: { note: 'llamar al 2945123456', tags: ['dni 30123456'] },
    });
    expect(result).toEqual({ citizen: { note: 'llamar al [phone]', tags: ['dni [dni]'] } });
  });

  it('replaces values of sensitive keys regardless of content', () => {
    const result = redactDetails({
      password: 'x',
      accessToken: 'y',
      headers: { Authorization: 'z', cookie: 'w', 'x-api-key': 'k' },
      secret: { nested: true },
      url: '/inbox',
    });
    expect(result).toEqual({
      password: '[redacted]',
      accessToken: '[redacted]',
      headers: { Authorization: '[redacted]', cookie: '[redacted]', 'x-api-key': '[redacted]' },
      secret: '[redacted]',
      url: '/inbox',
    });
  });

  it('redacts numbers that look like personal data', () => {
    expect(redactDetails({ dni: 30123456, phone: 2945123456, count: 42 })).toEqual({
      dni: '[dni]',
      phone: '[phone]',
      count: 42,
    });
  });

  it('keeps booleans, null and short numbers', () => {
    expect(redactDetails({ ok: true, missing: null, retries: 3 })).toEqual({ ok: true, missing: null, retries: 3 });
  });

  it('serializes Error instances with redacted message and stack', () => {
    const error = new Error('fallo con DNI 30123456');
    const result = redactDetails({ error }) as { error: { name: string; message: string; stack?: string } };
    expect(result.error.name).toBe('Error');
    expect(result.error.message).toBe('fallo con DNI [dni]');
    expect(result.error.stack ?? '').not.toContain('30123456');
  });

  it(`truncates objects nested deeper than ${MAX_DETAILS_DEPTH} levels`, () => {
    const deep = { l1: { l2: { l3: { l4: { l5: { l6: 'too deep' } } } } } };
    expect(redactDetails(deep)).toEqual({ l1: { l2: { l3: { l4: { l5: '[truncated]' } } } } });
  });

  it('survives circular references', () => {
    const node: Record<string, unknown> = { name: 'loop' };
    node.self = node;
    expect(() => redactDetails(node)).not.toThrow();
  });

  it(`truncates details larger than ${MAX_DETAILS_CHARS} serialized characters`, () => {
    const result = redactDetails({ blob: 'a'.repeat(MAX_DETAILS_CHARS * 2) }) as {
      truncated: boolean;
      preview: string;
    };
    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBe(MAX_DETAILS_CHARS);
  });

  it('never returns raw personal data in the serialized output', () => {
    const serialized = JSON.stringify(
      redactDetails({ message: 'DNI 30123456, tel 2945123456, token=abc', extra: [{ email: 'a@b.com' }] }),
    );
    for (const raw of ['30123456', '2945123456', 'token=abc', 'a@b.com']) {
      expect(serialized).not.toContain(raw);
    }
  });
});
