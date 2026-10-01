import { changeErrorStatus } from './change-status';

const ERROR_ID = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';

// Status change - validated input reaches the repository; failures become a generic message.
describe('changeErrorStatus', () => {
  it('saves a valid status change', async () => {
    const saveStatus = vi.fn(async () => {});

    await expect(changeErrorStatus({ id: ERROR_ID, status: 'resolved' }, { saveStatus })).resolves.toEqual({
      status: 'ok',
    });
    expect(saveStatus).toHaveBeenCalledWith(ERROR_ID, 'resolved');
  });

  it('rejects an invalid id or status without saving', async () => {
    const saveStatus = vi.fn(async () => {});

    expect((await changeErrorStatus({ id: 'nope', status: 'resolved' }, { saveStatus })).status).toBe('invalid');
    expect((await changeErrorStatus({ id: ERROR_ID, status: 'deleted' }, { saveStatus })).status).toBe('invalid');
    expect(saveStatus).not.toHaveBeenCalled();
  });

  it('reports a failure when the repository throws', async () => {
    const saveStatus = vi.fn(async () => {
      throw new Error('error_logs.not_found');
    });

    await expect(changeErrorStatus({ id: ERROR_ID, status: 'open' }, { saveStatus })).resolves.toEqual({
      status: 'failed',
    });
  });
});
