import type { ErrorStatus } from '@epuyen/shared';

import { errorStatusChangeSchema } from '@/contracts/errors';

// Status ports - repository update (RLS + guard trigger enforce role and immutable fields).
export type ChangeStatusDeps = {
  saveStatus: (id: string, status: ErrorStatus) => Promise<void>;
};

// Status outcome - saved, rejected input, or persistence failure.
export type ChangeStatusResult = { status: 'ok' } | { status: 'invalid' } | { status: 'failed' };

// Status change - validates id/status, then persists; never throws.
export async function changeErrorStatus(input: unknown, deps: ChangeStatusDeps): Promise<ChangeStatusResult> {
  const parsed = errorStatusChangeSchema.safeParse(input);
  if (!parsed.success) return { status: 'invalid' };

  try {
    await deps.saveStatus(parsed.data.id, parsed.data.status);
    return { status: 'ok' };
  } catch {
    return { status: 'failed' };
  }
}
