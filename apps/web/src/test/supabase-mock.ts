import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@epuyen/shared';

// Mock types - recorded builder calls and queued PostgREST-like results.
export type RecordedCall = { table: string; method: string; args: unknown[] };
export type MockResult = { data: unknown; error: { message: string; code?: string } | null };

type MockUser = { id: string; email?: string } | null;

// Supabase mock - chainable query builder per table; awaiting a chain resolves the next queued result.
export function createSupabaseMock() {
  const calls: RecordedCall[] = [];
  const queues = new Map<string, MockResult[]>();
  let user: MockUser = null;
  let authError: { message: string } | null = null;
  const authCalls: { method: string; args: unknown[] }[] = [];

  // Result queue - each awaited query on a table consumes one result (default: empty success).
  const nextResult = (table: string): MockResult => queues.get(table)?.shift() ?? { data: null, error: null };

  // Builder proxy - records every method call and is thenable.
  const builder = (table: string): unknown => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (value: MockResult) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(nextResult(table)).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            calls.push({ table, method: String(prop), args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  };

  // Client surface - from() plus the auth methods used by repositories, gateways and guards.
  const client = {
    from: (table: string) => builder(table),
    auth: {
      getUser: async () => {
        authCalls.push({ method: 'getUser', args: [] });
        return { data: { user: authError ? null : user }, error: authError };
      },
      signInWithPassword: async (credentials: unknown) => {
        authCalls.push({ method: 'signInWithPassword', args: [credentials] });
        return { data: { user: authError ? null : user, session: null }, error: authError };
      },
      signOut: async (options?: unknown) => {
        authCalls.push({ method: 'signOut', args: [options] });
        return { error: authError };
      },
    },
  } as unknown as SupabaseClient<Database>;

  // Test controls - queue results, set the session user / auth error, inspect recorded calls.
  return {
    client,
    calls,
    authCalls,
    queue(table: string, ...results: MockResult[]) {
      queues.set(table, [...(queues.get(table) ?? []), ...results]);
    },
    setUser(next: MockUser) {
      user = next;
    },
    setAuthError(next: { message: string } | null) {
      authError = next;
    },
    callsFor(table: string) {
      return calls.filter((call) => call.table === table).map(({ method, args }) => ({ method, args }));
    },
  };
}
