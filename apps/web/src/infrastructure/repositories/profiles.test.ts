import { describe, expect, it } from 'vitest';
import { createSupabaseMock } from '@/test/supabase-mock';
import { RepositoryError } from './errors';
import { findProfileById, updateProfileAvatarPath, updateProfileName } from './profiles';

// Fixtures - a database row (snake_case) and the expected domain profile (camelCase).
const USER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const ORG_ID = '7d3c1f9e-2b4a-4c8d-9e1f-0a2b3c4d5e6f';

const row = {
  id: USER_ID,
  org_id: ORG_ID,
  full_name: 'Ana Pérez',
  avatar_path: null,
  role: 'operator',
  is_active: false,
};

// Profile lookup - by verified session user id.
describe('findProfileById', () => {
  it('maps the row to a domain profile', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: row, error: null });

    await expect(findProfileById(mock.client, USER_ID)).resolves.toEqual({
      id: USER_ID,
      orgId: ORG_ID,
      fullName: 'Ana Pérez',
      avatarPath: null,
      role: 'operator',
      isActive: false,
    });
    expect(mock.callsFor('profiles')).toEqual([
      { method: 'select', args: ['id, org_id, full_name, avatar_path, role, is_active'] },
      { method: 'eq', args: ['id', USER_ID] },
      { method: 'maybeSingle', args: [] },
    ]);
  });

  it('returns null when the profile does not exist', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: null, error: null });
    await expect(findProfileById(mock.client, USER_ID)).resolves.toBeNull();
  });

  it('throws a RepositoryError when the query fails', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: null, error: { message: 'boom' } });
    await expect(findProfileById(mock.client, USER_ID)).rejects.toMatchObject({
      name: 'RepositoryError',
      code: 'profiles.read_failed',
    });
  });

  it('throws a RepositoryError when the row does not match the contract', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: { ...row, role: 'root' }, error: null });
    await expect(findProfileById(mock.client, USER_ID)).rejects.toBeInstanceOf(RepositoryError);
  });
});

// Name update - own row only, zero affected rows is an error.
describe('updateProfileName', () => {
  it('updates full_name of the given user', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: [{ id: USER_ID }], error: null });

    await updateProfileName(mock.client, USER_ID, 'Ana María Pérez');

    expect(mock.callsFor('profiles')).toEqual([
      { method: 'update', args: [{ full_name: 'Ana María Pérez' }] },
      { method: 'eq', args: ['id', USER_ID] },
      { method: 'select', args: ['id'] },
    ]);
  });

  it('throws profiles.not_updated when RLS affects zero rows', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: [], error: null });
    await expect(updateProfileName(mock.client, USER_ID, 'Ana')).rejects.toMatchObject({ code: 'profiles.not_updated' });
  });

  it('throws profiles.write_failed when the update errors', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: null, error: { message: 'check violation' } });
    await expect(updateProfileName(mock.client, USER_ID, 'Ana')).rejects.toMatchObject({ code: 'profiles.write_failed' });
  });
});

// Avatar path update - set a new object path or clear it.
describe('updateProfileAvatarPath', () => {
  it('sets avatar_path for the given user', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: [{ id: USER_ID }], error: null });

    await updateProfileAvatarPath(mock.client, USER_ID, `${ORG_ID}/${USER_ID}/new.png`);

    expect(mock.callsFor('profiles')[0]).toEqual({
      method: 'update',
      args: [{ avatar_path: `${ORG_ID}/${USER_ID}/new.png` }],
    });
  });

  it('clears avatar_path with null', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: [{ id: USER_ID }], error: null });

    await updateProfileAvatarPath(mock.client, USER_ID, null);

    expect(mock.callsFor('profiles')[0]).toEqual({ method: 'update', args: [{ avatar_path: null }] });
  });

  it('throws profiles.not_updated when RLS affects zero rows', async () => {
    const mock = createSupabaseMock();
    mock.queue('profiles', { data: [], error: null });
    await expect(updateProfileAvatarPath(mock.client, USER_ID, null)).rejects.toMatchObject({
      code: 'profiles.not_updated',
    });
  });
});
