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

  // Client surface - from() and auth.getUser() are enough for repositories and guards.
  const client = {
    from: (table: string) => builder(table),
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
  } as unknown as SupabaseClient<Database>;

  // Test controls - queue results, set the session user, inspect calls of one table.
  return {
    client,
    calls,
    queue(table: string, ...results: MockResult[]) {
      queues.set(table, [...(queues.get(table) ?? []), ...results]);
    },
    setUser(next: MockUser) {
      user = next;
    },
    callsFor(table: string) {
      return calls.filter((call) => call.table === table).map(({ method, args }) => ({ method, args }));
    },
  };
}
