#!/usr/bin/env node
/**
 * Documents expected organizations / org_settings columns after reconcile.
 *
 * Contract (must hold after fresh `npm run db:reset`):
 *   organizations: id, name, slug, timezone, created_at, updated_at
 *   org_settings: exists with org_id referencing organizations
 *
 * SQL assertions live in scripts/assert-org-superset-columns.sql.
 *
 * When local Supabase is up:
 *   node scripts/assert-org-superset-columns.mjs
 * (wraps `node scripts/supabase.mjs db query --local -f …` when the CLI supports it,
 *  otherwise prints the SQL path and exits 2 so CI/agents do not fake green.)
 *
 * This Cloud Agent environment has no Docker/Podman — do not treat absence of
 * a run here as proof. Task 2.1 stays open until a human/local run passes.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REQUIRED_ORG_COLUMNS = ['id', 'name', 'slug', 'timezone', 'created_at', 'updated_at'];
const SQL_FILE = resolve('scripts/assert-org-superset-columns.sql');

console.log('Expected organizations columns:', REQUIRED_ORG_COLUMNS.join(', '));
console.log('Expected org_settings: table present with org_id');
console.log('SQL assertion file:', SQL_FILE);

const result = spawnSync(
  process.execPath,
  ['scripts/supabase.mjs', 'db', 'query', '--local', '-f', SQL_FILE],
  { stdio: 'inherit', env: process.env },
);

if (result.error) {
  console.error('Could not invoke supabase wrapper:', result.error.message);
  console.error('Run the SQL file manually after db:reset when containers are available.');
  process.exit(2);
}

if (result.status === 0) {
  console.log('assert-org-superset-columns: PASS');
  process.exit(0);
}

console.error(
  `assert-org-superset-columns: supabase db query exited ${result.status ?? 'unknown'}.`,
);
console.error(
  'If the CLI flag set differs, apply scripts/assert-org-superset-columns.sql with psql against local DB.',
);
process.exit(result.status ?? 2);
