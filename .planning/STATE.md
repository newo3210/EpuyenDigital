# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 3 — `mesa-entrada-inbox` (plan written, waiting for approval)

## Current Position

Phase: 1 Fundación + Phase 2 WhatsApp channel core + Phase 2.1 Inspectoría pets on main  
Plan: OpenSpec `mesa-entrada-inbox` **drafted 2026-11-07, not approved for apply**  
Status: Channel on main via PR #6. Inbox plan is in `openspec/changes/mesa-entrada-inbox/`. No triage code yet.  
Last activity: 2026-11-07 — director plan for INB-01..15; waiting for explicit approval before apply

Progress: [████░░░░░░] ~35% (foundation + areas/operators + WA channel archived)

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

### Pending Todos

- Human approval of `openspec/changes/mesa-entrada-inbox/` before any apply
- Then implement INB-01..15 (claim/delegate, realtime, SLA business hours, ticks, dual coords, manual area)
- Live `supabase db reset` / curl / E2E when containers available
- WA-08 media outbound and WA-11 send_mode chooser stay outside this inbox plan. WA-05 thread media is inside the plan.
- Optional: adversarial close of `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Agent env sin Docker/Podman for live SQL/E2E
- Shared line still enqueues pet `process_inbound` for all non-fromMe inbound. The inbox plan leaves that behavior in place on purpose.

### Process

- 2026-11-06: `areas-operators-admin` archived; merge PR #5
- 2026-11-06: `whatsapp-channel-core` adversarial PASS WITH GAPS, archived; merge PR #6
- 2026-11-07: `mesa-entrada-inbox` proposal, specs, design, and tasks drafted. Apply not started.

## Session Continuity

Last session: 2026-11-07
Stopped at: OpenSpec plan for `mesa-entrada-inbox` ready. Apply is blocked until the user says the plan is approved.
Resume file: `openspec/changes/mesa-entrada-inbox/proposal.md` (enrich notes in gitignored `tmp/mesa-entrada-inbox-enriched-us.md`)
