import { esAR } from '@/i18n/es-AR';

const copy = esAR.notes.errors;

type PostgrestLike = {
  message?: string;
  hint?: string | null;
};

export function mapNoteError(error: PostgrestLike): string {
  const code = `${error.hint ?? ''} ${error.message ?? ''}`;
  if (code.includes('INVALID_FIELD')) return copy.invalidField;
  if (code.includes('FORBIDDEN') || code.includes('NOT_FOUND')) return copy.forbidden;
  return copy.failed;
}
