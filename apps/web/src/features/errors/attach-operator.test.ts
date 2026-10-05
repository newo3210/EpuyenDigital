// @vitest-environment node
import { attachRequestOperator, type AttachOperatorDeps, type RequestOperator } from './attach-operator';
import type { LogErrorInput } from './log-error';

const INPUT: LogErrorInput = { source: 'web', level: 'error', message: 'boom', traceId: 'trace-0001' };
const OPERATOR: RequestOperator = {
  orgId: 'aaaaaaaa-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-0000000000a1',
};
const COOKIE = 'sb-127-auth-token=base64-abc; other=1';

// Deps builder - operator resolver spy with a configurable outcome.
function makeDeps(resolve: AttachOperatorDeps['resolveOperator'] = async () => OPERATOR) {
  return { resolveOperator: vi.fn(resolve) };
}

// Enrichment - spec scenario "Server error with signed-in operator".
describe('attachRequestOperator', () => {
  it('sets org and user of the signed-in active operator', async () => {
    const deps = makeDeps();

    await expect(attachRequestOperator(INPUT, COOKIE, deps)).resolves.toEqual({
      ...INPUT,
      orgId: OPERATOR.orgId,
      userId: OPERATOR.userId,
    });
    expect(deps.resolveOperator).toHaveBeenCalledWith(COOKIE);
  });

  it('keeps the input unchanged without a cookie header', async () => {
    const deps = makeDeps();

    await expect(attachRequestOperator(INPUT, undefined, deps)).resolves.toBe(INPUT);
    expect(deps.resolveOperator).not.toHaveBeenCalled();
  });

  it('keeps the input unchanged when no active operator is found', async () => {
    await expect(attachRequestOperator(INPUT, COOKIE, makeDeps(async () => null))).resolves.toBe(INPUT);
  });

  it('never throws when the resolver fails', async () => {
    const deps = makeDeps(async () => {
      throw new Error('auth down');
    });

    await expect(attachRequestOperator(INPUT, COOKIE, deps)).resolves.toBe(INPUT);
  });
});
