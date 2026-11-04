import { createSupabaseMock } from '@/test/supabase-mock';
import { removeAvatarObject, uploadAvatarObject } from './avatars';

const PATH = 'org-1/user-1/new.png';
const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

// Upload - writes to the avatars bucket with the sniffed content type and never overwrites.
describe('uploadAvatarObject', () => {
  it('uploads with content type and upsert disabled', async () => {
    const mock = createSupabaseMock();

    await uploadAvatarObject(mock.client, PATH, BYTES, 'image/png');

    expect(mock.storageCalls).toEqual([
      { bucket: 'avatars', method: 'upload', args: [PATH, BYTES, { contentType: 'image/png', upsert: false }] },
    ]);
  });

  it('throws storage.write_failed when the policy rejects the write', async () => {
    const mock = createSupabaseMock();
    mock.setStorageError({ message: 'new row violates row-level security policy' });

    await expect(uploadAvatarObject(mock.client, PATH, BYTES, 'image/png')).rejects.toMatchObject({
      name: 'RepositoryError',
      code: 'storage.write_failed',
    });
  });
});

// Remove - deletes one object from the avatars bucket.
describe('removeAvatarObject', () => {
  it('removes the object path', async () => {
    const mock = createSupabaseMock();

    await removeAvatarObject(mock.client, PATH);

    expect(mock.storageCalls).toEqual([{ bucket: 'avatars', method: 'remove', args: [[PATH]] }]);
  });

  it('throws storage.remove_failed on error', async () => {
    const mock = createSupabaseMock();
    mock.setStorageError({ message: 'boom' });

    await expect(removeAvatarObject(mock.client, PATH)).rejects.toMatchObject({ code: 'storage.remove_failed' });
  });
});
