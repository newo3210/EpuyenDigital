# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 4 — `pobladores-ficha` (applied, adversarial PASS WITH GAPS, archive waits for a human OK)

## Current Position

Phase: 1 Fundación + Phase 2 WhatsApp channel core + Phase 2.1 Inspectoría pets + Phase 3 inbox archived  
Plan: OpenSpec `mesa-entrada-inbox` **archived 2026-11-08** at `openspec/changes/archive/2026-11-08-mesa-entrada-inbox`  
Status: Main specs updated (`inbox-queue`, `conversation-ownership`, `inbox-thread`, plus inbound, outbound, and municipal-areas). Live `supabase test db` remains a residual gap.  
Last activity: 2026-11-08 — pobladores ficha applied on `cursor/pobladores-ficha-3654` (SQL, panel, docs). Live database still blocked.

Progress: [███████░░░] ~65% (foundation + areas/operators + WA channel + inbox archived)

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (reconcile-foundation-to-main, areas-operators-admin, whatsapp-channel-core, mesa-entrada-inbox)
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

- Human OK before archiving `pobladores-ficha`
- Live `supabase db reset` / curl / browser claim-delegate when containers are available
- WA-08 media outbound and WA-11 send_mode chooser
- Optional: adversarial close of `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Agent env sin Docker/Podman for live SQL/E2E
- Shared line still enqueues pet `process_inbound` for all non-fromMe inbound. That stays on purpose.

### Process

- 2026-11-06: `areas-operators-admin` archived; merge PR #5
- 2026-11-06: `whatsapp-channel-core` adversarial PASS WITH GAPS, archived; merge PR #6
- 2026-11-08: `mesa-entrada-inbox` adversarial PASS WITH GAPS, archived after human OK

## Session Continuity

Last session: 2026-11-08
Stopped at: Ficha applied. Adversarial review is PASS WITH GAPS (no blocker, no major). Archive waits for a human OK.
Resume file: `openspec/changes/pobladores-ficha/tasks.md`
