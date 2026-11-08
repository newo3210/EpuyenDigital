import { esAR } from '@/i18n/es-AR';

const copy = esAR.tasks.errors;

type PostgrestLike = {
  message?: string;
  hint?: string | null;
  details?: string | null;
};

// Hint mapping - SQL codes become the sentence the operator reads.
export function mapTaskError(error: PostgrestLike): string {
  const code = `${error.hint ?? ''} ${error.message ?? ''} ${error.details ?? ''}`;
  if (code.includes('CLAIM_CONFLICT')) return copy.claimConflict;
  if (code.includes('NOT_ASSIGNEE')) return copy.notAssignee;
  if (code.includes('NOTE_REQUIRED')) return copy.noteRequired;
  if (code.includes('CANCEL_REASON_REQUIRED')) return copy.cancelReasonRequired;
  if (code.includes('INVALID_OUTCOME')) return copy.invalidOutcome;
  if (code.includes('INVALID_STATUS')) return copy.invalidStatus;
  if (code.includes('INVALID_TARGET')) return copy.invalidTarget;
  if (code.includes('INVALID_FIELD')) return copy.invalidField;
  if (code.includes('FORBIDDEN') || code.includes('NOT_FOUND')) return copy.forbidden;
  return copy.failed;
}
