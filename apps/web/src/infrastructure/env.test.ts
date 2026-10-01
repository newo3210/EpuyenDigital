import { describe, expect, it } from 'vitest';
import { MissingEnvError, parsePublicEnv, parseServerEnv } from './env';

// Valid fixtures - minimal complete public and server environments.
const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};
const validServer = { ...validPublic, SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' };

// Public env - browser-safe variables required at startup.
describe('parsePublicEnv', () => {
  it('returns the parsed variables when all are present', () => {
    expect(parsePublicEnv(validPublic)).toEqual(validPublic);
  });

  it('ignores unrelated variables', () => {
    expect(parsePublicEnv({ ...validPublic, PATH: '/usr/bin' })).toEqual(validPublic);
  });

  it('throws an error naming NEXT_PUBLIC_SUPABASE_URL when it is missing', () => {
    const withoutUrl = { NEXT_PUBLIC_SUPABASE_ANON_KEY: validPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY };
    expect(() => parsePublicEnv(withoutUrl)).toThrow(MissingEnvError);
    expect(() => parsePublicEnv(withoutUrl)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('treats an empty string as missing', () => {
    expect(() => parsePublicEnv({ ...validPublic, NEXT_PUBLIC_SUPABASE_ANON_KEY: '' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it('rejects a URL that is not valid and names the variable', () => {
    expect(() => parsePublicEnv({ ...validPublic, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it('lists every missing variable in a single error', () => {
    try {
      parsePublicEnv({});
      expect.unreachable('parsePublicEnv should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError);
      expect((error as MissingEnvError).variables).toEqual([
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      ]);
    }
  });
});

// Server env - public variables plus server-only secrets.
describe('parseServerEnv', () => {
  it('returns public and server-only variables when all are present', () => {
    expect(parseServerEnv(validServer)).toEqual(validServer);
  });

  it('throws an error naming SUPABASE_SERVICE_ROLE_KEY when it is missing', () => {
    expect(() => parseServerEnv(validPublic)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
