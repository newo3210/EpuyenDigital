import { z, type ZodTypeAny } from 'zod';

// Raw env input - process.env or any plain record of optional strings.
type EnvSource = Record<string, string | undefined>;

// Required string - empty values count as missing.
const requiredString = z.string().trim().min(1);

// Public env schema - variables inlined into the browser bundle.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: requiredString.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredString,
});

// Server env schema - public variables plus server-only secrets.
const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: requiredString,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

// Missing env error - carries the offending variable names for fail-fast startup messages.
export class MissingEnvError extends Error {
  readonly variables: string[];

  constructor(variables: string[]) {
    super(`Missing or invalid environment variables: ${variables.join(', ')}`);
    this.name = 'MissingEnvError';
    this.variables = variables;
  }
}

// Generic parser - validates a source and maps Zod issues to variable names.
function parseEnv<Schema extends ZodTypeAny>(schema: Schema, source: EnvSource): z.infer<Schema> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const variables = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  throw new MissingEnvError(variables);
}

// Public API - parse public (startup, browser) or server (secrets) environments.
export function parsePublicEnv(source: EnvSource): PublicEnv {
  return parseEnv(publicEnvSchema, source);
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  return parseEnv(serverEnvSchema, source);
}
