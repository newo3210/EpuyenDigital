import { RepositoryError } from '@/infrastructure/repositories/errors';
import { esAR } from '@/i18n/es-AR';

// Admin write failure kinds - last_admin and duplicate are mapped for the UI.
export type AdminWriteFailure =
  | { status: 'last_admin'; message: string }
  | { status: 'duplicate'; message: string }
  | { status: 'failed'; message: string };

// Error mapping - Postgres P0001 last_admin / unique violations → typed UI outcomes.
export function mapAdminWriteError(error: unknown, fallbackMessage: string): AdminWriteFailure {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof RepositoryError ? error.code : '';

  if (/last_admin/i.test(message)) {
    return { status: 'last_admin', message: esAR.settings.operators.errors.lastAdmin };
  }

  if (code === 'areas.foreign_org' || /areas\.foreign_org/i.test(message)) {
    return { status: 'failed', message: esAR.settings.operators.errors.invalidAreas };
  }

  if (/areas|area_name|areas_org_id_name/i.test(message) && /duplicate|unique/i.test(message)) {
    return { status: 'duplicate', message: esAR.settings.areas.errors.duplicateName };
  }

  if (
    /duplicate|unique|already\s+(?:been\s+)?registered|already\s+exists|users_email/i.test(message) ||
    code.includes('duplicate')
  ) {
    return { status: 'duplicate', message: esAR.settings.operators.errors.duplicateEmail };
  }

  return { status: 'failed', message: fallbackMessage };
}
