# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 3 — `mesa-entrada-inbox` (applied, waiting for adversarial review)

## Current Position

Phase: 1 Fundación + Phase 2 WhatsApp channel core + Phase 2.1 Inspectoría pets on main + Phase 3 inbox applied  
Plan: OpenSpec `mesa-entrada-inbox` **approved and applied 2026-11-08**  
Status: Triage code is on `cursor/mesa-entrada-inbox-3654`. Live `supabase test db`, curl against Postgres, and browser claim/delegate are blocked: this VM has no Docker.  
Last activity: 2026-11-08 — apply of INB-01..15 (minus WA-08 and WA-11)

Progress: [██████░░░░] ~55% (foundation + areas/operators + WA channel archived + inbox implemented, not archived)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (reconcile-foundation-to-main, areas-operators-admin, whatsapp-channel-core)
- Average duration: -
- Total execution time: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [2026-11-06 areas]: Temp password once; admin-only writes; last-admin + advisory lock; email on profiles; SLA columns; default area swap; Auth compensation; memberships RPC
- [2026-11-06 WA]: Channel before inbox; conversations now; encrypted line secrets; auth-before-ignore webhook; persist-then-send; shared line default Mesa; dual coords deferred to inbox
- [2026-11-07 inbox plan]: Pet `process_inbound` stays on every non-fromMe inbound. Manual area change does not gate the pet bot, because the shared line defaults to Mesa and the registry is live.
- [2026-11-08 inbox apply]: Transitions are SECURITY DEFINER. Friday 13:00 ART + 120 business minutes is Monday 09:00 ART. Sound stays off until `inbox-sound` is enabled.

### Pending Todos

- Adversarial review of `mesa-entrada-inbox`, then human OK before archive
- Live `supabase db reset` / curl / browser claim-delegate when containers are available
- WA-08 media outbound and WA-11 send_mode chooser stay outside this inbox change
- Optional: adversarial close of `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Agent env sin Docker/Podman for live SQL/E2E
- Shared line still enqueues pet `process_inbound` for all non-fromMe inbound. The inbox change leaves that behavior in place on purpose.

### Process

- 2026-11-06: `areas-operators-admin` archived; merge PR #5
- 2026-11-06: `whatsapp-channel-core` adversarial PASS WITH GAPS, archived; merge PR #6
- 2026-11-07: `mesa-entrada-inbox` proposal, specs, design, and tasks drafted
- 2026-11-08: plan approved and applied. Not archived.

## Session Continuity

Last session: 2026-11-08
Stopped at: Apply of `mesa-entrada-inbox` is in the branch. Verification reports record unit PASS and live DB/browser BLOCKED. Archive waits for adversarial review and human OK.
Resume file: `openspec/changes/mesa-entrada-inbox/tasks.md`
