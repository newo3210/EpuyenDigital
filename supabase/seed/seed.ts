import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Seed constants - the municipality organization and the admin display name.
const ORGANIZATION = { slug: 'epuyen', name: 'Municipalidad de Epuyén' } as const;
const ADMIN_FULL_NAME = 'Administrador';
const LIST_USERS_PAGE_SIZE = 200;

// Seed env schema - service role access plus the initial admin credentials.
const seedEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(10),
});

type SeedEnv = z.infer<typeof seedEnvSchema>;

// Env parsing - fails with the names of missing variables, never their values.
function parseSeedEnv(source: NodeJS.ProcessEnv): SeedEnv {
  const result = seedEnvSchema.safeParse(source);
  if (result.success) return result.data;
  const names = result.error.issues.map((issue) => String(issue.path[0]));
  throw new Error(`Missing or invalid seed variables: ${[...new Set(names)].join(', ')}`);
}

// Organization upsert - idempotent by unique slug.
async function upsertOrganization(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from('organizations')
    .upsert(ORGANIZATION, { onConflict: 'slug' })
    .select('id')
    .single();
  if (error) throw new Error(`organizations upsert failed: ${error.message}`);
  return data.id as string;
}

// Auth user lookup - pages through users because the Admin API has no get-by-email.
async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE });
    if (error) throw new Error(`auth listUsers failed: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < LIST_USERS_PAGE_SIZE) return null;
  }
}

// Admin auth user - created only when absent (existing password is never changed).
async function ensureAdminUser(admin: SupabaseClient, env: SeedEnv): Promise<{ id: string; created: boolean }> {
  const existingId = await findUserIdByEmail(admin, env.SEED_ADMIN_EMAIL);
  if (existingId) return { id: existingId, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`auth createUser failed: ${error.message}`);
  return { id: data.user.id, created: true };
}

// Admin profile - inserted once; on re-runs only enforces org, admin role and active flag.
async function ensureAdminProfile(admin: SupabaseClient, userId: string, orgId: string): Promise<boolean> {
  const { data: existing, error: readError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (readError) throw new Error(`profiles read failed: ${readError.message}`);

  const { error } = existing
    ? await admin.from('profiles').update({ org_id: orgId, role: 'admin', is_active: true }).eq('id', userId)
    : await admin
        .from('profiles')
        .insert({ id: userId, org_id: orgId, full_name: ADMIN_FULL_NAME, role: 'admin', is_active: true });
  if (error) throw new Error(`profiles write failed: ${error.message}`);
  return !existing;
}

// Entry point - org, admin user, admin profile; prints a summary without secrets.
async function main(): Promise<void> {
  const env = parseSeedEnv(process.env);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orgId = await upsertOrganization(admin);
  const user = await ensureAdminUser(admin, env);
  const profileCreated = await ensureAdminProfile(admin, user.id, orgId);

  console.log(
    `Seed OK - organization "${ORGANIZATION.slug}" (${orgId}); admin user ${user.created ? 'created' : 'already existed'}; admin profile ${profileCreated ? 'created' : 'updated'}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
