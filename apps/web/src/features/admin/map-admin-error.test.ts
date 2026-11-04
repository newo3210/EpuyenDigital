import { RepositoryError } from '@/infrastructure/repositories/errors';
import { esAR } from '@/i18n/es-AR';
import { mapAdminWriteError } from './map-admin-error';

// last_admin / duplicate mapping - Postgres and Auth errors become typed UI outcomes.
describe('mapAdminWriteError', () => {
  it('maps last_admin from a repository error message', () => {
    const error = new RepositoryError('operators.write_failed', 'P0001 last_admin');
    expect(mapAdminWriteError(error, 'fallback')).toEqual({
      status: 'last_admin',
      message: esAR.settings.operators.errors.lastAdmin,
    });
  });

  it('maps duplicate email signals', () => {
    const error = new Error('AuthApiError: A user with this email address has already been registered');
    expect(mapAdminWriteError(error, 'fallback')).toEqual({
      status: 'duplicate',
      message: esAR.settings.operators.errors.duplicateEmail,
    });
  });

  it('falls back to the provided message', () => {
    expect(mapAdminWriteError(new Error('boom'), 'fallback')).toEqual({
      status: 'failed',
      message: 'fallback',
    });
  });
});
