import { esAR } from '@/i18n/es-AR';

const copy = esAR.inbox.errors;

type PostgrestLike = {
  message?: string;
  hint?: string | null;
  details?: string | null;
};

// Hint mapping - SQL hint/message codes become operator-facing Spanish.
export function mapInboxError(error: PostgrestLike): string {
  const code = `${error.hint ?? ''} ${error.message ?? ''}`;
  const name = error.details?.trim();
  if (code.includes('CLAIM_CONFLICT') || code.includes('NOT_OWNER')) {
    return name ? copy.ownedBy.replace('{name}', name) : copy.conflict;
  }
  if (code.includes('NOTE_REQUIRED')) return copy.noteRequired;
  if (code.includes('NOT_ASSIGNEE')) return copy.notAssignee;
  if (code.includes('INVALID_TARGET')) return copy.invalidTarget;
  if (code.includes('INVALID_COLUMN')) return copy.invalidColumn;
  if (code.includes('INVALID_AREA')) return copy.invalidArea;
  if (code.includes('FORBIDDEN') || code.includes('NOT_FOUND')) return copy.forbidden;
  return copy.failed;
}
