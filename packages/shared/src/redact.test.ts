import { describe, expect, it } from 'vitest';
import { MAX_DETAILS_CHARS, MAX_DETAILS_DEPTH, MAX_REDACT_INPUT_CHARS, redactDetails, redactText } from './redact';

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

// Argentine formats - spec scenario "Argentine formats and JSON secrets".
describe('redactText - Argentine phone and DNI formats', () => {
  it.each([
    ['02945-15-123456'],
    ['2945-15-123456'],
    ['(02945) 15-123456'],
    ['(02945) 451234'],
    ['+54 (2945) 451234'],
    ['2945.451234'],
    ['+54 9 2945 12-3456'],
    ['011 4555-6677'],
  ])('masks phone %s', (phone) => {
    expect(redactText(`llamar al ${phone} hoy`)).toBe('llamar al [phone] hoy');
  });

  it.each([['30 123 456'], ['30-123-456'], ['30.123.456'], ['5.123.456']])('masks DNI %s', (dni) => {
    expect(redactText(`dni ${dni} ok`)).toBe('dni [dni] ok');
  });

  it('keeps dates, times, IPs and short local numbers intact', () => {
    const text = 'el 2026-10-05 a las 13:06:36 desde 127.0.0.1 interno 4512 paso 05/10/2026';
    expect(redactText(text)).toBe(text);
  });
});

// Secret formats - JSON pairs, key suffixes and Supabase secret keys.
describe('redactText - secret formats', () => {
  it('masks JSON string secrets', () => {
    expect(redactText('{"refresh_token":"abc123xyzSECRET","user":"ana"}')).toBe(
      '{"refresh_token":"[redacted]","user":"ana"}',
    );
  });

  it('masks JSON secrets with spaces and non-string values', () => {
    expect(redactText('{ "api_key" : 123456789, "password": "hunter2" }')).toBe(
      '{ "api_key":"[redacted]", "password":"[redacted]" }',
    );
  });

  it('masks escaped JSON secrets inside strings', () => {
    expect(redactText('body={\\"access_token\\":\\"abc\\"}')).not.toContain('abc');
  });

  it('masks keys ending in key', () => {
    expect(redactText('key=abc service_key: xyz')).toBe('key=[redacted] service_key=[redacted]');
  });

  it('masks bare Supabase secret keys', () => {
    // Fixture built at runtime so secret scanners never see a literal key.
    const fakeKey = ['sb', 'secret', 'FAKEFAKEFAKE-test_only0000'].join('_');
    expect(redactText(`using ${fakeKey} now`)).toBe('using [redacted] now');
  });
});

// Regressions - spec scenario "Quoted secrets and glued DNIs"; every case was masked by the pre-hardening rules.
describe('redactText - quoted secrets and glued DNIs', () => {
  it.each([
    ['password="hunter2pass"', 'hunter2pass'],
    ["{ password: 'hunter2pass' }", 'hunter2pass'],
    ['token: "abc123xyz"', 'abc123xyz'],
    ["refresh_token='abc123xyz'", 'abc123xyz'],
  ])('masks the quoted secret value in %s', (input, secret) => {
    expect(redactText(input)).not.toContain(secret);
  });

  it('masks a JSON secret value containing an escaped quote entirely', () => {
    const result = redactText(String.raw`{"password":"hun\"ter2"}`);
    expect(result).not.toContain('hun');
    expect(result).not.toContain('ter2');
  });

  it.each(['dni_30123456.pdf', '30123456_frente.jpg', 'nro.30123456', 'Doc.30.123.456', 'id30123456'])(
    'masks the DNI glued to letters, underscores or dots in %s',
    (input) => {
      const result = redactText(input);
      expect(result).toContain('[dni]');
      expect(result).not.toMatch(/30\.?123\.?456/);
    },
  );

  it.each(['trace 12345678-abcd-4ef0-8123-456789abcdef', 'on 2026-10-05', 'from 127.0.0.1'])(
    'keeps UUIDs, dates and short IPs intact in %s',
    (input) => {
      expect(redactText(input)).toBe(input);
    },
  );
});

// Strict superset (design D13) - spec scenario "DNIs next to digits and dots"; privacy wins over IPs/decimals.
describe('redactText - DNIs next to digits and dots', () => {
  it.each([
    ['30123456.1.pdf', /30\.?123\.?456/],
    ['dni_30123456.2024.pdf', /30123456/],
    ['v2.30123456', /30123456/],
    ['0.30123456', /30123456/],
    ['1.30.123.456', /30\.123\.456/],
    ['30.123.456.789', /30\.123\.456/],
    ['x 1234567.89', /1234567/],
  ])('masks the DNI in %s', (input, raw) => {
    const result = redactText(input);
    expect(result).toContain('[dni]');
    expect(result).not.toMatch(raw);
  });

  it.each([
    ['host 10.168.100.200', 'host [dni].200'],
    ['version 1.30123456', 'version 1.[dni]'],
  ])('accepts partial masking of DNI-shaped runs inside IPs and decimals: %s', (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });
});

// Superset property (design D13) - whatever the 65eb994 redaction removed, the current one removes too.
describe('redactText - superset of the 65eb994 redaction', () => {
  const jwt = ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ0ZXN0In0', 'c2lnbmF0dXJlX3Rlc3Q'].join('.');
  const tokens: Array<[raw: string, sensitive: string]> = [
    ['30123456', '30123456'],
    ['7123456', '7123456'],
    ['30.123.456', '30.123.456'],
    ['7.123.456', '7.123.456'],
    ['30 123 456', '30 123 456'],
    ['30-123-456', '30-123-456'],
    ['2945451234', '2945451234'],
    ['2945 451234', '2945 451234'],
    ['2945-451234', '2945-451234'],
    ['11 4567 8901', '11 4567 8901'],
    ['+54 9 2945 451234', '2945 451234'],
    ['+5492945451234', '2945451234'],
    ['02945-15-451234', '451234'],
    ['(02945) 451234', '451234'],
    ['2945.451234', '2945.451234'],
    ['20-30123456-7', '30123456'],
    ['20301234567', '20301234567'],
    ['ana.perez@epuyen.gob.ar', 'ana.perez@epuyen.gob.ar'],
    ['x_y+z@mail.com', 'x_y+z@mail.com'],
    ['password=hunter2pass', 'hunter2pass'],
    ['api_key=abcDEF123', 'abcDEF123'],
    ['token: s3cr3tvalue', 's3cr3tvalue'],
    ['client_secret=topsecret99', 'topsecret99'],
    ['Bearer abcdefghijkl', 'abcdefghijkl'],
    [`jwt ${jwt}`, jwt],
    ['authorization: Basic dXNlcjpwYXNz', 'dXNlcjpwYXNz'],
    ['cookie: sid=abc123def', 'abc123def'],
  ];
  const contexts: Array<[prefix: string, suffix: string]> = [
    ['', ''],
    ['DNI ', ' ok'],
    ['dni_', '.pdf'],
    ['', '_frente.jpg'],
    ['nro.', ''],
    ['id', ''],
    ['v2.', ''],
    ['0.', ''],
    ['', '.1.pdf'],
    ['', '.2024.pdf'],
    ['1.', '.9'],
    ['x ', '.89'],
    ['(', ')'],
    ['"', '"'],
    ["'", "'"],
    ['[', ']'],
    ['tel:', ''],
    ['/path/', '/x'],
    ['?q=', '&a=1'],
    ['-', ''],
    ['', '-'],
    ['a-', '-b'],
    ['\n', '\n'],
    ['{"v":"', '"}'],
    ['=', ''],
    ['#', ''],
    ['text ', ', more text'],
  ];

  it('masks every token the legacy redaction masked, in every context', async () => {
    const { legacyRedactText } = await import('./redact.legacy.fixture');
    const leaks: string[] = [];
    for (const [raw, sensitive] of tokens) {
      for (const [prefix, suffix] of contexts) {
        const input = `${prefix}${raw}${suffix}`;
        if (!legacyRedactText(input).includes(sensitive)) {
          if (redactText(input).includes(sensitive)) leaks.push(JSON.stringify(input));
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});

// Linear time - spec scenario "Oversized input"; adversarial inputs must not backtrack.
describe('redactText - performance', () => {
  const SIZE = 200_000;

  it.each([
    ['dotted local parts', 'a.'.repeat(SIZE / 2)],
    ['long word', 'a'.repeat(SIZE)],
    ['digits and spaces', '1 '.repeat(SIZE / 2)],
    ['jwt prefixes', 'eyJ'.repeat(SIZE / 3)],
    ['secret keys', 'token'.repeat(SIZE / 5)],
    ['parentheses', '(0'.repeat(SIZE / 2)],
    ['unclosed quoted secrets', 'password="\\'.repeat(SIZE / 11)],
    ['unclosed JSON secrets', '"token":"\\x'.repeat(SIZE / 11)],
    ['escape runs after a secret key', `secret='${'\\\\'.repeat(SIZE / 2)}`],
    ['glued digit runs', 'a1234567.'.repeat(SIZE / 9)],
  ])('redacts 200 KB of %s within 200 ms', (_label, input) => {
    const start = performance.now();
    redactText(input);
    expect(performance.now() - start).toBeLessThan(200);
  });

  it(`caps input at ${MAX_REDACT_INPUT_CHARS} characters before matching`, () => {
    const result = redactText('x'.repeat(MAX_REDACT_INPUT_CHARS * 2));
    expect(result.length).toBeLessThanOrEqual(MAX_REDACT_INPUT_CHARS + '[truncated]'.length);
    expect(result.endsWith('[truncated]')).toBe(true);
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
