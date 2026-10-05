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

// Privacy first (design D13) - spec scenario "DNIs next to digits and dots"; privacy wins over IPs/decimals.
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

// UUID exemption (design D13) - spec scenario "UUIDs stay intact"; trace and row ids are never personal data.
describe('redactText - UUIDs stay intact', () => {
  const SAMPLES = 20_000;

  it(`leaves ${SAMPLES} random UUIDs unchanged, alone and inside a support URL`, () => {
    const changed: string[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const id = crypto.randomUUID();
      const url = `/support/errors?id=${id}`;
      if (redactText(id) !== id || redactText(url) !== url) changed.push(id);
    }
    expect(changed.slice(0, 5)).toEqual([]);
  });

  it('keeps upper-case UUIDs and masks personal data right next to one', () => {
    const id = '550E8400-E29B-41D4-A716-446655440000';
    expect(redactText(`${id} dni 30123456`)).toBe(`${id} dni [dni]`);
    expect(redactText(`trace=${id};tel 2945451234`)).toBe(`trace=${id};tel [phone]`);
  });

  it(`leaves ${SAMPLES} random UUIDs glued to underscores, letters or digits unchanged`, () => {
    const changed: string[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const id = crypto.randomUUID();
      for (const text of [`avatar_${id}.png`, `${id}_v2`, `row${id}`, `id${id}`, `file${id}.pdf`, `${id}abc`, `1${id}`]) {
        if (redactText(text) !== text) changed.push(text);
      }
    }
    expect(changed.slice(0, 5)).toEqual([]);
  }, 30_000);

  it('still masks an email whose local part is a UUID', () => {
    expect(redactText('550e8400-e29b-41d4-a716-446655440000@epuyen.gob.ar')).toBe('[email]');
  });
});

// Phones next to other numbers (design D14, S-1) - spec scenario "Phones next to other numbers".
describe('redactText - phones next to other numbers', () => {
  it.each([
    ['calle 123 2945 451234', 'calle 123 [phone]'],
    ['123 294 445 1234', '123 [phone]'],
    ['500 0351 456-7890', '500 [phone]'],
    ['nro 12 2945 451234', 'nro 12 [phone]'],
    ['2026 011 4555-6677', '2026 [phone]'],
    ['Ruta 40 km 1850 011 4555-6677', 'Ruta 40 km 1850 [phone]'],
    ['dni 30123456 11 4567 8901', 'dni [dni] [phone]'],
    ['7123456 11 4567 8901', '[dni] [phone]'],
    ['30123456\n011 4567 8901', '[dni]\n[phone]'],
    ['dni 30 123 456 2945 451234', 'dni [dni] [phone]'],
    ['+54 9 294 445-1234', '[phone]'],
    ['tel +54 9 299 512-3456 ok', 'tel [phone] ok'],
    ['+54 294 445-1234', '[phone]'],
    ['9 294 445 1234', '[phone]'],
    ['nro 12 294 445 1234', 'nro 12 [phone]'],
    ['piso 3 294 445-1234', 'piso 3 [phone]'],
    ['2026-10-05 294 445-1234', '2026-10-05 [phone]'],
    ['el 05/10 294 445-1234', 'el 05/10 [phone]'],
    ['2945 451 234', '[phone]'],
    ['tel 2945-451-234.', 'tel [phone].'],
    ['30-123-456 2026', '[dni] 2026'],
    ['30.123.456 2026', '[dni] 2026'],
    ['+54-9-294-445-7788', '[phone]'],
    ['54-294-445-7788', '[phone]'],
    ['9-294-445-7788', '[phone]'],
    ['+54.9.294.445.7788', '[phone]'],
    ['DNI 30 123 456 1830hs', 'DNI [dni] 1830hs'],
    ['30 123 456.2024_frente.jpg', '[dni].2024_frente.jpg'],
    ['30 123 456 2026_x', '[dni] 2026_x'],
    ['30 123 456-2026_x', '[dni]-2026_x'],
  ])('masks every phone and DNI in %j', (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });
});

// Secrets with quotes or after a key word (design D14, S-2 a, b) - spec scenario of the same name.
describe('redactText - secrets with quotes or after a key word', () => {
  it.each([
    ["password=Abc'123!xyz", 'password=[redacted]'],
    ['token=ab"cdefgh', 'token=[redacted]'],
    ['missing key: token: abc123secret', 'missing key=[redacted]'],
    ['cache key: password: hunter2pass', 'cache key=[redacted]'],
    ['config key: secret = s3cr3tvalue', 'config key=[redacted]'],
    ['key: password = hunter2pass', 'key=[redacted]'],
    ['missing key: service_key: abc123secret', 'missing key=[redacted]'],
    ['cache key: secret_key: abc123secret', 'cache key=[redacted]'],
    ['missing key: session: abc123secret', 'missing key=[redacted]'],
    ['missing key: credential: abc123secret', 'missing key=[redacted]'],
    ['password_confirmation=hunter2pass', 'password_confirmation=[redacted]'],
    ['tokenValue=abc123', 'tokenValue=[redacted]'],
    ['access_tokens=abc123', 'access_tokens=[redacted]'],
    ['token_value: abc123', 'token_value=[redacted]'],
    ['{"passwordHash":"h4shvalue"}', '{"passwordHash":"[redacted]"}'],
    ['{"accessTokenValue":"abc123"}', '{"accessTokenValue":"[redacted]"}'],
    ["{ password_confirmation: 'hunter2pass', refresh_token_hash: 'abc123hash' }", '{ password_confirmation=[redacted], refresh_token_hash=[redacted] }'],
    ['password=monkey:Zx91', 'password=[redacted]'],
    ['password=whiskey:4ever', 'password=[redacted]'],
    ['password: Turkey=2024!', 'password=[redacted]'],
    ['password=secret=abc123', 'password=[redacted]'],
    ['token=hockey:Abc123', 'token=[redacted]'],
  ])('masks the whole secret value in %j', (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  it('keeps keys that only start with "key"', () => {
    expect(redactText('keyboard=qwerty')).toBe('keyboard=qwerty');
  });

  it.each([
    ['token:\nphone: 2945 451234', '451234', '[phone]'],
    ['session:\ndni: 30 123 456', '123 456', '[dni]'],
    ['token: QUJDREVGR0g=\nphone: 2945 451234', '451234', '[phone]'],
    ['secret=QUJDREVGR0g= 2945 451234', '451234', '[phone]'],
  ])('never lets a chained link hide the personal data after it in %j', (input, sensitive, placeholder) => {
    const result = redactText(input);
    expect(result).not.toContain(sensitive);
    expect(result).toContain(placeholder);
    expect(result).not.toContain('QUJDREVGR0g');
  });
});

// Serialized headers and inspected objects (design D15, T-3) - spec scenario of the same name.
describe('redactText - serialized headers and inspected objects', () => {
  it.each([
    ['{"authorization":"Basic dXNlcjpwYXNz"}', 'dXNlcjpwYXNz'],
    ['{"Authorization": "Token abc123opaque"}', 'abc123opaque'],
    ['authorization=Basic dXNlcjpwYXNz', 'dXNlcjpwYXNz'],
    ['authorization="Basic dXNlcjpwYXNz"', 'dXNlcjpwYXNz'],
    ['{"cookie":"sid=abc123def"}', 'abc123def'],
    ["{ 'x-api-key': 'sk_live_abc123' }", 'sk_live_abc123'],
    ["{ 'x-auth-token': 'abc123opaque' }", 'abc123opaque'],
    ["missing key: 'token': abc123secret", 'abc123secret'],
    ['{"session":"s3ss10nvalue","user":"ana"}', 's3ss10nvalue'],
    ['{"set-cookie":["sid=abc123def; Path=/","rt=r3fr3sh99"]}', 'abc123def'],
    ['{"set-cookie":["sid=abc123def; Path=/","rt=r3fr3sh99"]}', 'r3fr3sh99'],
    ["{ 'set-cookie': [ 'sid=abc123def' ] }", 'abc123def'],
    ['{"token":["abc123opaque"]}', 'abc123opaque'],
    ["Map(1) { 'cookie' => 'sid=abc123def' }", 'abc123def'],
    [JSON.stringify({ authorization: 'Bearer abc123opaque', cookie: 'sid=abc123def' }), 'abc123def'],
    [JSON.stringify({ authorization: 'Bearer abc123opaque', 'x-api-key': 'k3yvalue99' }), 'k3yvalue99'],
    [JSON.stringify({ Authorization: 'Bearer abc123opaque', apikey: 'k3yvalue99' }, null, 2), 'k3yvalue99'],
    ["{\n  'set-cookie': [\n    'connect.sid=s%3Aabc123def.sig; Path=/; HttpOnly',\n    'rt=r3fr3sh99; Path=/'\n  ]\n}", 'abc123def'],
    ["{\n  'set-cookie': [\n    'connect.sid=s%3Aabc123def.sig; Path=/; HttpOnly',\n    'rt=r3fr3sh99; Path=/'\n  ]\n}", 'r3fr3sh99'],
    [JSON.stringify({ 'set-cookie': ['sid=abc123def'] }, null, 2), 'abc123def'],
    ['refresh failed for sb-ref-auth-token.0=base64-s3ss10nchunk; sb-ref-auth-token.1=s3ss10nchunk2', 's3ss10nchunk'],
    ['{"sb-ref-auth-token.0":"base64-s3ss10nchunk"}', 's3ss10nchunk'],
    ["{ 'sb-ref-auth-token.0': 'base64-s3ss10nchunk' }", 's3ss10nchunk'],
  ])('masks the credential in %j', (input, credential) => {
    const result = redactText(input);
    expect(result).not.toContain(credential);
    expect(result).toContain('[redacted]');
  });

  it('keeps the shape of inspected objects', () => {
    expect(redactText("{ 'x-api-key': 'sk_live_abc123', id: 7 }")).toBe("{ 'x-api-key': '[redacted]', id: 7 }");
    expect(redactText('{"set-cookie":["sid=abc123def"],"id":7}')).toBe('{"set-cookie":"[redacted]","id":7}');
    expect(redactText("Map(1) { 'cookie' => 'sid=abc123def' }")).toBe("Map(1) { 'cookie' => '[redacted]' }");
  });
});

// Redaction contract (design D14) - spec scenario "Redaction contract corpus"; every token masked on its own terms.
describe('redactText - redaction contract corpus', () => {
  const jwt = ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ0ZXN0In0', 'c2lnbmF0dXJlX3Rlc3Q'].join('.');

  // Contract tokens - raw value plus the identifying part that must never survive.
  const dniTokens: Array<[raw: string, sensitive: string]> = [
    ['30123456', '123456'],
    ['7123456', '123456'],
    ['30.123.456', '123.456'],
    ['7.123.456', '123.456'],
    ['30 123 456', '123 456'],
    ['30-123-456', '123-456'],
  ];
  const otherTokens: Array<[raw: string, sensitive: string]> = [
    ['2945451234', '451234'],
    ['2945 451234', '451234'],
    ['2945-451234', '451234'],
    ['11 4567 8901', '4567 8901'],
    ['+54 9 2945 451234', '451234'],
    ['+5492945451234', '451234'],
    ['02945-15-451234', '451234'],
    ['(02945) 451234', '451234'],
    ['2945.451234', '451234'],
    ['011 4555-6677', '4555-6677'],
    ['(0294) 15-412-3456', '412-3456'],
    ['+54 9 294 445-7788', '7788'],
    ['+54 294 445-7788', '7788'],
    ['294 445-7788', '7788'],
    ['0294 445-7788', '7788'],
    ['2945 451 234', '451 234'],
    ['2945-451-234', '451-234'],
    ['20-30123456-7', '30123456'],
    ['20301234567', '30123456'],
    ['ana.perez@epuyen.gob.ar', 'ana.perez@epuyen.gob.ar'],
    ['x_y+z@mail.com', 'x_y+z@mail.com'],
    ['password=hunter2pass', 'hunter2pass'],
    ["password=Abc'123!xyz", "123!xyz"],
    ['token=ab"cdefgh', 'cdefgh'],
    ['api_key=abcDEF123', 'abcDEF123'],
    ['token: s3cr3tvalue', 's3cr3tvalue'],
    ['missing key: token: abc123secret', 'abc123secret'],
    ['config key: secret = s3cr3tvalue', 's3cr3tvalue'],
    ['client_secret=topsecret99', 'topsecret99'],
    ['Bearer abcdefghijkl', 'abcdefghijkl'],
    [`jwt ${jwt}`, jwt],
    ['authorization: Basic dXNlcjpwYXNz', 'dXNlcjpwYXNz'],
    ['cookie: sid=abc123def', 'abc123def'],
    ['password=monkey:Zx91', 'monkey'],
    ['password: Turkey=2024!', 'Turkey'],
    ['{"authorization":"Basic dXNlcjpwYXNz"}', 'dXNlcjpwYXNz'],
    ['authorization=Basic dXNlcjpwYXNz', 'dXNlcjpwYXNz'],
    ['{"cookie":"sid=abc123def"}', 'abc123def'],
    ["{ 'x-api-key': 'sk_live_abc123' }", 'sk_live_abc123'],
    ["missing key: 'token': abc123secret", 'abc123secret'],
    ['+54-9-294-445-7788', '7788'],
    ['+54.9.294.445.7788', '7788'],
    ['54-294-445-7788', '7788'],
    ['missing key: service_key: abc123secret', 'abc123secret'],
    ['missing key: session: abc123secret', 'abc123secret'],
    ['password_confirmation=hunter2pass', 'hunter2pass'],
    ['{"passwordHash":"h4shvalue"}', 'h4shvalue'],
    ["refresh_token_hash: 'abc123hash'", 'abc123hash'],
    ['{"set-cookie":["sid=abc123def; Path=/"]}', 'abc123def'],
    ["{ 'set-cookie': [ 'sid=abc123def' ] }", 'abc123def'],
    ["'cookie' => 'sid=abc123def'", 'abc123def'],
    ['{"authorization":"Bearer abc123opaque","cookie":"sid=abc123def"}', 'abc123def'],
    ["{ 'set-cookie': [\n    'sid=abc123def; Path=/',\n    'rt=r3fr3sh99'\n  ] }", 'abc123def'],
    ['sb-ref-auth-token.0=base64-s3ss10nchunk', 's3ss10nchunk'],
    ['token:\nphone: 2945 451234', '451234'],
  ];
  const tokens = [...dniTokens, ...otherTokens];

  // Contract contexts - separated and numeric neighbours for every token; glued ones for DNIs only.
  const separatedContexts: Array<[prefix: string, suffix: string]> = [
    ['', ''],
    ['DNI ', ' ok'],
    ['(', ')'],
    ['"', '"'],
    ["'", "'"],
    ['[', ']'],
    ['tel:', ''],
    ['/path/', '/x'],
    ['?q=', '&a=1'],
    ['\n', '\n'],
    ['{"v":"', '"}'],
    ['=', ''],
    ['#', ''],
    ['text ', ', more text'],
    ['calle 123 ', ''],
    ['nro 12 ', ''],
    ['2026 ', ''],
    ['Ruta 40 km 1850 ', ''],
    ['', ' 123'],
    ['', ' 2026'],
    ['30123456 ', ''],
    ['30123456\n', ''],
    ['7123456 ', ''],
    ['', ' 30123456'],
    ['piso 3 ', ''],
    ['2026-10-05 ', ''],
    ['13:06:36 ', ''],
    ['05/10 ', ''],
  ];
  const gluedContexts: Array<[prefix: string, suffix: string]> = [
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
    ['a-', '-b'],
    ['DNI ', ' 1830hs'],
    ['', '.2024_frente.jpg'],
    ['', ' 2026_x'],
  ];
  const pairSeparators = [' ', '\n', ', '];

  // Leak collector - inputs whose redacted output still holds one of the sensitive parts.
  function leaksOf(cases: Array<[input: string, sensitive: string[]]>): string[] {
    return cases
      .filter(([input, sensitive]) => sensitive.some((part) => redactText(input).includes(part)))
      .map(([input]) => JSON.stringify(input));
  }

  it('masks every token in every separated context and next to other numbers', () => {
    const cases = tokens.flatMap(([raw, sensitive]) =>
      separatedContexts.map(([prefix, suffix]): [string, string[]] => [`${prefix}${raw}${suffix}`, [sensitive]]),
    );
    expect(leaksOf(cases)).toEqual([]);
  });

  it('masks every DNI glued to letters, underscores, dots or digit-dot sequences', () => {
    const cases = dniTokens.flatMap(([raw, sensitive]) =>
      gluedContexts.map(([prefix, suffix]): [string, string[]] => [`${prefix}${raw}${suffix}`, [sensitive]]),
    );
    expect(leaksOf(cases)).toEqual([]);
  });

  it('masks both tokens of every pair', () => {
    const cases = tokens.flatMap(([first, firstSensitive]) =>
      tokens.flatMap(([second, secondSensitive]) =>
        pairSeparators.map((separator): [string, string[]] => [
          `${first}${separator}${second}`,
          [firstSensitive, secondSensitive],
        ]),
      ),
    );
    expect(leaksOf(cases)).toEqual([]);
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
    ['UUID runs between digits', '550e8400-e29b-41d4-a716-446655440000 30123456 '.repeat(SIZE / 46)],
    ['short digit groups rejected as phones', '12 345 '.repeat(SIZE / 7)],
    ['key words chained before a secret', 'key: '.repeat(SIZE / 5)],
    ['key words inside long keys', 'a-token-'.repeat(SIZE / 8)],
    ['unclosed secret arrays', '"token":['.repeat(SIZE / 9)],
    ['chained links without a value', 'token: a: b: c: d: e: '.repeat(SIZE / 22)],
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
