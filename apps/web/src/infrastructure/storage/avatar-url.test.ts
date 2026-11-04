import { avatarPublicUrl } from './avatar-url';

// Avatar URL - public bucket object URL from the stored path; null when no avatar.
describe('avatarPublicUrl', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the public object URL', () => {
    expect(avatarPublicUrl('org-1/user-1/avatar.png')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/avatars/org-1/user-1/avatar.png',
    );
  });

  it('returns null without a path', () => {
    expect(avatarPublicUrl(null)).toBeNull();
  });

  it('encodes each path segment so stored values cannot inject URL syntax', () => {
    expect(avatarPublicUrl('org-1/user 1/a?b#c.png')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/avatars/org-1/user%201/a%3Fb%23c.png',
    );
  });
});
