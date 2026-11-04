import { AVATAR_MAX_BYTES } from '@/contracts/profile';
import { esAR } from '@/i18n/es-AR';
import { uploadAvatar, type UploadAvatarDeps } from './upload-avatar';

const ORG_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-0000000000a1';
const NEW_ID = '11111111-2222-4333-8444-555555555555';
const copy = esAR.profile;

// Sample payloads - real file signatures padded to the requested size.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_SIGNATURE = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

function fileOf(signature: number[], size: number) {
  const bytes = new Uint8Array(size);
  bytes.set(signature);
  return { bytes, size };
}

// Test deps - storage and profile ports recorded in call order.
function makeDeps(overrides: Partial<UploadAvatarDeps> = {}) {
  const events: string[] = [];
  const deps: UploadAvatarDeps = {
    orgId: ORG_ID,
    userId: USER_ID,
    previousPath: null,
    generateId: () => NEW_ID,
    uploadObject: vi.fn(async (path: string, _bytes: Uint8Array, contentType: string) => {
      events.push(`upload:${path}:${contentType}`);
    }),
    saveAvatarPath: vi.fn(async (_userId: string, path: string) => {
      events.push(`save:${path}`);
    }),
    removeObject: vi.fn(async (path: string) => {
      events.push(`remove:${path}`);
    }),
    ...overrides,
  };
  return { deps, events };
}

// Valid images - stored under org/user with the sniffed extension, then linked to the profile.
describe('uploadAvatar - valid images', () => {
  it('stores a 500 KB PNG and saves its path', async () => {
    const { deps, events } = makeDeps();
    const path = `${ORG_ID}/${USER_ID}/${NEW_ID}.png`;

    const result = await uploadAvatar(fileOf(PNG_SIGNATURE, 500 * 1024), deps);

    expect(result).toEqual({ status: 'ok', path });
    expect(events).toEqual([`upload:${path}:image/png`, `save:${path}`]);
  });

  it.each([
    ['jpg', 'image/jpeg', JPEG_SIGNATURE],
    ['webp', 'image/webp', WEBP_SIGNATURE],
  ])('detects %s by magic bytes', async (ext, mime, signature) => {
    const { deps, events } = makeDeps();

    await uploadAvatar(fileOf(signature, 1024), deps);

    expect(events[0]).toBe(`upload:${ORG_ID}/${USER_ID}/${NEW_ID}.${ext}:${mime}`);
  });

  it('accepts exactly 2 MB', async () => {
    const { deps } = makeDeps();

    await expect(uploadAvatar(fileOf(PNG_SIGNATURE, AVATAR_MAX_BYTES), deps)).resolves.toMatchObject({ status: 'ok' });
  });

  it('deletes the previous object after linking the new one', async () => {
    const previousPath = `${ORG_ID}/${USER_ID}/old.png`;
    const { deps, events } = makeDeps({ previousPath });

    await uploadAvatar(fileOf(PNG_SIGNATURE, 1024), deps);

    expect(events.at(-1)).toBe(`remove:${previousPath}`);
  });

  it('still succeeds when deleting the previous object fails', async () => {
    const { deps } = makeDeps({
      previousPath: `${ORG_ID}/${USER_ID}/old.png`,
      removeObject: vi.fn(async () => {
        throw new Error('storage down');
      }),
    });

    await expect(uploadAvatar(fileOf(PNG_SIGNATURE, 1024), deps)).resolves.toMatchObject({ status: 'ok' });
  });
});

// Invalid files - rejected before any storage call.
describe('uploadAvatar - invalid files', () => {
  it('rejects files over 2 MB', async () => {
    const { deps, events } = makeDeps();

    const result = await uploadAvatar(fileOf(PNG_SIGNATURE, 3 * 1024 * 1024), deps);

    expect(result).toEqual({ status: 'invalid', message: copy.errors.invalidImage });
    expect(events).toEqual([]);
  });

  it('rejects a PDF by its magic bytes', async () => {
    const { deps, events } = makeDeps();

    const result = await uploadAvatar(fileOf(PDF_SIGNATURE, 1024), deps);

    expect(result).toEqual({ status: 'invalid', message: copy.errors.invalidImage });
    expect(events).toEqual([]);
  });

  it('rejects an empty file', async () => {
    const { deps, events } = makeDeps();

    await expect(uploadAvatar({ bytes: new Uint8Array(0), size: 0 }, deps)).resolves.toEqual({
      status: 'invalid',
      message: copy.errors.invalidImage,
    });
    expect(events).toEqual([]);
  });
});

// Failures - storage or profile errors leave no orphan object and no broken link.
describe('uploadAvatar - failures', () => {
  it('returns a generic message when the upload fails', async () => {
    const { deps, events } = makeDeps({
      uploadObject: vi.fn(async () => {
        throw new Error('storage.write_failed');
      }),
    });

    await expect(uploadAvatar(fileOf(PNG_SIGNATURE, 1024), deps)).resolves.toEqual({
      status: 'failed',
      message: copy.errors.saveFailed,
    });
    expect(events).toEqual([]);
  });

  it('removes the new object when saving the path fails', async () => {
    const previousPath = `${ORG_ID}/${USER_ID}/old.png`;
    const newPath = `${ORG_ID}/${USER_ID}/${NEW_ID}.png`;
    const { deps, events } = makeDeps({
      previousPath,
      saveAvatarPath: vi.fn(async () => {
        throw new Error('profiles.not_updated');
      }),
    });

    await expect(uploadAvatar(fileOf(PNG_SIGNATURE, 1024), deps)).resolves.toMatchObject({ status: 'failed' });
    expect(events).toEqual([`upload:${newPath}:image/png`, `remove:${newPath}`]);
  });
});
