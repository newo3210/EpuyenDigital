import type { OperatorDirectoryEntry } from '@/contracts/operators';

// List-operators ports - directory reader (RLS: org members).
export type ListOperatorsDeps = {
  listOperators: () => Promise<OperatorDirectoryEntry[]>;
};

// List-operators outcome - directory rows or soft failure.
export type ListOperatorsResult =
  | { status: 'ok'; operators: OperatorDirectoryEntry[] }
  | { status: 'failed' };

// List-operators use case - org directory with email and area memberships.
export async function listOperators(deps: ListOperatorsDeps): Promise<ListOperatorsResult> {
  try {
    const operators = await deps.listOperators();
    return { status: 'ok', operators };
  } catch {
    return { status: 'failed' };
  }
}
