import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Fixed org / line / area ids - must match supabase/seed.sql so SQL + TS seeds coexist.
const ORG_ID = '00000000-0000-4000-8000-000000000001';
const LINE_ID = '00000000-0000-4000-8000-000000000002';
const MESA_AREA_ID = '00000000-0000-4000-8000-000000000010';
const INSPECTORIA_AREA_ID = '00000000-0000-4000-8000-000000000011';
const ORGANIZATION = {
  id: ORG_ID,
  slug: 'epuyen',
  name: 'Municipalidad de Epuyén',
  timezone: 'America/Argentina/Buenos_Aires',
} as const;
const INSPECTORIA_LINE = {
  id: LINE_ID,
  org_id: ORG_ID,
  name: 'Inspectoría',
  display_phone: '+5492944216586',
  evolution_instance: 'inspectoria',
  status: 'active',
} as const;
const SEED_AREAS = [
  {
    id: MESA_AREA_ID,
    name: 'Mesa de Entrada',
    description: 'Área hub de triage municipal',
    color: '#1f6f5c',
    is_default: true,
  },
  {
    id: INSPECTORIA_AREA_ID,
    name: 'Inspectoría',
    description: 'Registro de mascotas y fiscalización',
    color: '#185a4b',
    is_default: false,
  },
] as const;
const NEIGHBORHOODS = [
  { org_id: ORG_ID, neighborhood_normalized: 'centro', code: 'CENT' },
  { org_id: ORG_ID, neighborhood_normalized: 'epuyen', code: 'EPU' },
] as const;
const ADMIN_FULL_NAME = 'Administrador';
const DEFAULT_WEBHOOK_SECRET = 'dev-webhook-secret-change-me';
const LIST_USERS_PAGE_SIZE = 200;

// Seed env schema - service role access plus the initial admin credentials.
const seedEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SEED_ADMIN_EMAIL: z.string().email(),
  SEED_ADMIN_PASSWORD: z.string().min(10),
  SEED_WEBHOOK_SECRET: z.string().min(1).default(DEFAULT_WEBHOOK_SECRET),
});

type SeedEnv = z.infer<typeof seedEnvSchema>;

// Env parsing - fails with the names of missing variables, never their values.
function parseSeedEnv(source: NodeJS.ProcessEnv): SeedEnv {
  const result = seedEnvSchema.safeParse(source);
  if (result.success) return result.data;
  const names = result.error.issues.map((issue) => String(issue.path[0]));
  throw new Error(`Missing or invalid seed variables: ${[...new Set(names)].join(', ')}`);
}

// Organization upsert - prefer fixed UUID from seed.sql; never create a second epuyen org.
async function upsertOrganization(admin: SupabaseClient): Promise<string> {
  const { data: bySlug, error: slugError } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', ORGANIZATION.slug)
    .maybeSingle();
  if (slugError) throw new Error(`organizations read failed: ${slugError.message}`);
  if (bySlug?.id) return bySlug.id as string;

  const { data, error } = await admin
    .from('organizations')
    .upsert(
      {
        id: ORGANIZATION.id,
        name: ORGANIZATION.name,
        slug: ORGANIZATION.slug,
        timezone: ORGANIZATION.timezone,
      },
      { onConflict: 'id' },
    )
    .select('id')
    .single();
  if (error) throw new Error(`organizations upsert failed: ${error.message}`);
  return data.id as string;
}

// Org settings - mirror seed.sql (dry_run + Inspectoría allowlist phone).
async function upsertOrgSettings(admin: SupabaseClient, orgId: string): Promise<void> {
  const { error } = await admin.from('org_settings').upsert(
    {
      org_id: orgId,
      send_mode: 'dry_run',
      allowlist_phones: ['5492944216586'],
      registration_session_ttl_hours: 24,
      privacy_notice_version: 'v1',
    },
    { onConflict: 'org_id' },
  );
  if (error) throw new Error(`org_settings upsert failed: ${error.message}`);
}

// Inspectoría WhatsApp line - fixed id + evolution_instance match seed.sql.
async function upsertInspectoriaLine(admin: SupabaseClient, orgId: string): Promise<string> {
  const { data: byInstance, error: readError } = await admin
    .from('whatsapp_lines')
    .select('id')
    .eq('evolution_instance', INSPECTORIA_LINE.evolution_instance)
    .maybeSingle();
  if (readError) throw new Error(`whatsapp_lines read failed: ${readError.message}`);
  if (byInstance?.id) {
    const { error: updateError } = await admin
      .from('whatsapp_lines')
      .update({
        org_id: orgId,
        name: INSPECTORIA_LINE.name,
        display_phone: INSPECTORIA_LINE.display_phone,
        status: INSPECTORIA_LINE.status,
      })
      .eq('id', byInstance.id);
    if (updateError) throw new Error(`whatsapp_lines update failed: ${updateError.message}`);
    return byInstance.id as string;
  }

  const { data, error } = await admin
    .from('whatsapp_lines')
    .insert({
      id: INSPECTORIA_LINE.id,
      org_id: orgId,
      name: INSPECTORIA_LINE.name,
      display_phone: INSPECTORIA_LINE.display_phone,
      evolution_instance: INSPECTORIA_LINE.evolution_instance,
      status: INSPECTORIA_LINE.status,
    })
    .select('id')
    .single();
  if (error) throw new Error(`whatsapp_lines insert failed: ${error.message}`);
  return data.id as string;
}

// Line secret - SEED_WEBHOOK_SECRET or the same default as seed.sql.
async function upsertLineSecret(admin: SupabaseClient, lineId: string, webhookSecret: string): Promise<void> {
  const { error } = await admin.from('whatsapp_line_secrets').upsert(
    { line_id: lineId, webhook_secret: webhookSecret },
    { onConflict: 'line_id' },
  );
  if (error) throw new Error(`whatsapp_line_secrets upsert failed: ${error.message}`);
}

// Neighborhood codes - same rows as seed.sql.
async function upsertNeighborhoods(admin: SupabaseClient, orgId: string): Promise<void> {
  const rows = NEIGHBORHOODS.map((row) => ({ ...row, org_id: orgId }));
  const { error } = await admin.from('neighborhood_codes').upsert(rows, {
    onConflict: 'org_id,neighborhood_normalized',
  });
  if (error) throw new Error(`neighborhood_codes upsert failed: ${error.message}`);
}

// Municipal areas - Mesa (default) + Inspectoría with fixed UUIDs.
async function upsertAreas(admin: SupabaseClient, orgId: string): Promise<void> {
  const rows = SEED_AREAS.map((area) => ({
    id: area.id,
    org_id: orgId,
    name: area.name,
    description: area.description,
    color: area.color,
    is_active: true,
    is_default: area.is_default,
  }));
  const { error } = await admin.from('areas').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`areas upsert failed: ${error.message}`);
}

// Line default area - Inspectoria WhatsApp line routes to Inspectoría area.
async function linkLineDefaultArea(admin: SupabaseClient, lineId: string): Promise<void> {
  const { error } = await admin
    .from('whatsapp_lines')
    .update({ default_area_id: INSPECTORIA_AREA_ID })
    .eq('id', lineId);
  if (error) throw new Error(`whatsapp_lines default_area_id update failed: ${error.message}`);
}

// Admin memberships - seed admin belongs to Mesa (lead) and Inspectoría.
async function ensureAdminMemberships(admin: SupabaseClient, userId: string): Promise<void> {
  const rows = [
    { area_id: MESA_AREA_ID, user_id: userId, is_lead: true },
    { area_id: INSPECTORIA_AREA_ID, user_id: userId, is_lead: false },
  ];
  const { error } = await admin.from('area_members').upsert(rows, { onConflict: 'area_id,user_id' });
  if (error) throw new Error(`area_members upsert failed: ${error.message}`);
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

// Entry point - org + pet line bootstrap + admin user/profile; prints a summary without secrets.
async function main(): Promise<void> {
  const env = parseSeedEnv(process.env);
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orgId = await upsertOrganization(admin);
  await upsertOrgSettings(admin, orgId);
  const lineId = await upsertInspectoriaLine(admin, orgId);
  await upsertLineSecret(admin, lineId, env.SEED_WEBHOOK_SECRET);
  await upsertNeighborhoods(admin, orgId);
  await upsertAreas(admin, orgId);
  await linkLineDefaultArea(admin, lineId);

  const user = await ensureAdminUser(admin, env);
  const profileCreated = await ensureAdminProfile(admin, user.id, orgId);
  await ensureAdminMemberships(admin, user.id);

  console.log(
    `Seed OK - organization "${ORGANIZATION.slug}" (${orgId}); areas Mesa+Inspectoría; Inspectoría line ${lineId}; admin user ${user.created ? 'created' : 'already existed'}; admin profile ${profileCreated ? 'created' : 'updated'}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
