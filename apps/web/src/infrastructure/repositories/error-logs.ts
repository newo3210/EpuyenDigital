import {
  errorLogSchema,
  type Database,
  type ErrorLevel,
  type ErrorLog,
  type ErrorSource,
  type ErrorStatus,
  type Json,
} from '@epuyen/shared';
import { RepositoryError, type DbClient } from './errors';

// Row shape and columns - public.error_logs as read by the support screen.
type ErrorLogRow = Database['public']['Tables']['error_logs']['Row'];

const ERROR_LOG_COLUMNS =
  'id, org_id, source, level, message, details, trace_id, user_id, status, resolved_by, resolved_at, created_at';

// Page size bounds - default and hard cap for list queries.
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Insert input - already-redacted incident written with the admin client.
export type NewErrorLog = {
  orgId: string | null;
  source: ErrorSource;
  level: ErrorLevel;
  message: string;
  details: Record<string, unknown>;
  traceId: string;
  userId: string | null;
};

// List filters - all optional; dates are ISO timestamps (inclusive).
export type ErrorLogFilters = {
  status?: ErrorStatus;
  source?: ErrorSource;
  level?: ErrorLevel;
  from?: string;
  to?: string;
  limit?: number;
};

// Row mapping - snake_case row to validated camelCase domain error log.
function toErrorLog(row: ErrorLogRow): ErrorLog {
  const parsed = errorLogSchema.safeParse({
    id: row.id,
    orgId: row.org_id,
    source: row.source,
    level: row.level,
    message: row.message,
    details: row.details,
    traceId: row.trace_id,
    userId: row.user_id,
    status: row.status,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  });
  if (!parsed.success) throw new RepositoryError('error_logs.invalid_row', parsed.error.message);
  return parsed.data;
}

// Insert - returns the new row id; service role only (RLS has no insert policy).
export async function insertErrorLog(client: DbClient, input: NewErrorLog): Promise<string> {
  const { data, error } = await client
    .from('error_logs')
    .insert({
      org_id: input.orgId,
      source: input.source,
      level: input.level,
      message: input.message,
      details: input.details as NonNullable<Json>,
      trace_id: input.traceId,
      user_id: input.userId,
    })
    .select('id')
    .single();
  if (error) throw new RepositoryError('error_logs.write_failed', error.message);
  return data.id;
}

// List - newest first with optional filters; RLS scopes rows to admin/support of the org.
export async function listErrorLogs(client: DbClient, filters: ErrorLogFilters): Promise<ErrorLog[]> {
  let query = client.from('error_logs').select(ERROR_LOG_COLUMNS);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.level) query = query.eq('level', filters.level);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw new RepositoryError('error_logs.read_failed', error.message);
  return (data ?? []).map(toErrorLog);
}

// Status change - sends only status; the database trigger stamps resolved_by / resolved_at.
export async function changeErrorLogStatus(client: DbClient, id: string, status: ErrorStatus): Promise<ErrorLog> {
  const { data, error } = await client
    .from('error_logs')
    .update({ status })
    .eq('id', id)
    .select(ERROR_LOG_COLUMNS)
    .maybeSingle();
  if (error) throw new RepositoryError('error_logs.write_failed', error.message);
  if (!data) throw new RepositoryError('error_logs.not_found', `error log ${id} not visible or missing`);
  return toErrorLog(data);
}
