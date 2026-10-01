## Why

The repository contains only planning documents. Every roadmap phase depends on a working monorepo, a local Supabase stack, authenticated operators, organization-level data isolation, and a way to see errors. This change delivers that base so the next change (areas, operators, roles) and Phase 2 (WhatsApp channel) can build on it.

Roadmap: **Phase 1 — Fundación (change 1 of 2)** · Requirements: **FND-01, FND-06 (organization level), FND-07, FND-08**.

## What Changes

- npm workspaces monorepo: `apps/web` (Next.js 15, React 19, TypeScript strict, Tailwind, Radix), `packages/shared` (pure logic + contracts), `supabase/` (migrations, tests, seed).
- Local development environment on Podman: Supabase CLI local stack (fallback: dedicated cloud dev project), `.env.example`, one-command scripts (`dev`, `db:start`, `db:reset`, `db:seed`, `test`, `typecheck`, `lint`).
- Database foundation: `organizations`, `profiles` (role enum incl. `area_lead`, `is_active`), RLS helper functions, cross-organization isolation tests.
- Operator authentication: email + password login, persistent session, route protection, logout, inactive-profile lockout.
- Operator profile: edit own display name and avatar (public `avatars` bucket, path-scoped writes).
- Error tracking: `error_logs` table with redaction (DNI, CUIT, phone, email, tokens), trace id propagation, client error reporting endpoint, support screen for `admin` / `support` roles, 30-day purge.
- Panel shell: sidebar + top bar layout with placeholder sections (Mensajería, Pobladores, Tareas, Configuración, Soporte).
- Seed: organization "Municipalidad de Epuyén" and a first admin from environment variables.

## Capabilities

### New Capabilities
- `local-dev-environment`: developers boot the full local stack (web + Supabase) with documented commands and environment variables.
- `org-tenancy`: organizations, profiles, roles, RLS helpers, and guaranteed cross-organization isolation.
- `operator-auth`: login, session persistence, route protection, logout, inactive-profile lockout.
- `operator-profile`: operators edit their own display name and avatar.
- `error-tracking`: redacted error logging with trace ids and a support screen to triage errors.

### Modified Capabilities
- None (no existing specs).

## Impact

- New code: `apps/web/**`, `packages/shared/**`, `supabase/**`, root `package.json`, `tsconfig.base.json`, Vitest config.
- New dependencies: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `tailwindcss`, Radix primitives, `lucide-react`, `react-hook-form`; dev: `typescript`, `vitest`, `@testing-library/react`, `eslint`, `supabase` CLI.
- Local infrastructure: Podman containers for Supabase.
- Ported from reference CRM (see `docs/reuse-from-seguros.md` §6): RLS helpers, auth guards, avatars, error logs + redaction + trace id, RLS isolation test — each with the corrections listed there.
- Root docs: `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md` updated at the end.
