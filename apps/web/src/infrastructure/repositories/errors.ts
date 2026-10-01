import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@epuyen/shared';

// Database client - any typed Supabase client (server, admin or browser) handed in by the caller.
export type DbClient = SupabaseClient<Database>;

// Repository error - stable code for services plus the underlying driver message for logs.
export class RepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'RepositoryError';
    this.code = code;
  }
}
