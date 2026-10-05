import { esAR } from '@/i18n/es-AR';
import { updateName, type UpdateNameDeps } from './update-name';

const USER_ID = '00000000-0000-4000-8000-0000000000a1';
const copy = esAR.profile;

// Test deps - name persistence port that succeeds unless told otherwise.
function makeDeps(fails = false) {
  const saveName = vi.fn<UpdateNameDeps['saveName']>(async () => {
    if (fails) throw new Error('profiles.not_updated');
  });
  return { userId: USER_ID, saveName };
}

// Valid names - trimmed value is persisted and echoed back.
describe('updateName - valid', () => {
  it('saves a trimmed name', async () => {
    const deps = makeDeps();

    const result = await updateName({ fullName: '  Ana Pérez  ' }, deps);

    expect(result).toEqual({ status: 'ok', fullName: 'Ana Pérez' });
    expect(deps.saveName).toHaveBeenCalledWith(USER_ID, 'Ana Pérez');
  });

  it('accepts the 2 and 80 character bounds', async () => {
    const deps = makeDeps();

    await expect(updateName({ fullName: 'Al' }, deps)).resolves.toMatchObject({ status: 'ok' });
    await expect(updateName({ fullName: 'a'.repeat(80) }, deps)).resolves.toMatchObject({ status: 'ok' });
  });

  it('counts emoji and astral letters as one character each, like the database', async () => {
    const deps = makeDeps();

    await expect(updateName({ fullName: `Ana ${'\u{1f600}'.repeat(40)}` }, deps)).resolves.toMatchObject({
      status: 'ok',
    });
    await expect(updateName({ fullName: '\u{1d400}'.repeat(80) }, deps)).resolves.toMatchObject({ status: 'ok' });
  });
});

// Invalid names - field error, nothing persisted.
describe('updateName - invalid', () => {
  it.each([[''], ['A'], ['   B   '], ['a'.repeat(81)], ['\u{1d400}'.repeat(81)], ['A\u001c']])('rejects %j', async (fullName) => {
    const deps = makeDeps();

    const result = await updateName({ fullName }, deps);

    expect(result).toEqual({ status: 'invalid', fieldErrors: { fullName: copy.errors.nameLength } });
    expect(deps.saveName).not.toHaveBeenCalled();
  });

  it.each([['\u3164\u3164'], ['\u200e\u200f'], ['\u0301\u0301']])(
    'rejects the visually blank name %j with the visibility message',
    async (fullName) => {
      const deps = makeDeps();

      const result = await updateName({ fullName }, deps);

      expect(result).toEqual({ status: 'invalid', fieldErrors: { fullName: copy.errors.nameVisible } });
      expect(deps.saveName).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing name', async () => {
    const deps = makeDeps();

    await expect(updateName({}, deps)).resolves.toEqual({
      status: 'invalid',
      fieldErrors: { fullName: copy.errors.nameLength },
    });
  });
});

// Persistence failure - generic message, no crash.
describe('updateName - failure', () => {
  it('returns a generic message when saving fails', async () => {
    const deps = makeDeps(true);

    await expect(updateName({ fullName: 'Ana Pérez' }, deps)).resolves.toEqual({
      status: 'failed',
      message: copy.errors.saveFailed,
    });
  });
});
