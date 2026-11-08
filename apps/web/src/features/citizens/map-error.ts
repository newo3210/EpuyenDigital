import { esAR } from '@/i18n/es-AR';

const copy = esAR.citizens.errors;

type PostgrestLike = {
  message?: string;
  hint?: string | null;
};

// Hint mapping - SQL codes become the sentence the operator reads.
export function mapCitizenError(error: PostgrestLike): string {
  const code = `${error.hint ?? ''} ${error.message ?? ''}`;
  if (code.includes('NOTE_REQUIRED')) return copy.noteRequired;
  if (code.includes('MERGE_SELF')) return copy.mergeSelf;
  if (code.includes('MISSING_FIELDS')) return copy.missingFields;
  if (code.includes('ALREADY_REGISTERED')) return copy.alreadyRegistered;
  if (code.includes('INVALID_FIELD')) return copy.invalidField;
  if (code.includes('FORBIDDEN') || code.includes('NOT_FOUND')) return copy.forbidden;
  return copy.failed;
}
