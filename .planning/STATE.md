# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 3 — `mesa-entrada-inbox` (next)

## Current Position

Phase: 1 Fundación + Phase 2 WhatsApp channel core + Phase 2.1 Inspectoría pets on main  
Plan: OpenSpec `whatsapp-channel-core` **archived 2026-11-06**  
Status: Channel (conversations, line admin, inbound/outbound text, send_mode) on main via PR #6; inbox triage still next.  
Last activity: 2026-11-06 — human OK archive + merge WA channel; continue inbox

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
- [2026-11-06 WA]: Channel before inbox; conversations now; encrypted line secrets; auth-before-ignore webhook; persist-then-send; shared line default Mesa; dual coords deferred to inbox; pet process_inbound still on shared line until inbox routing

### Pending Todos

- Open + implement `mesa-entrada-inbox` (INB-01..15, dual coords + map, manual area routing, delivery ticks, claim/delegate, realtime)
- Live `supabase db reset` / curl / E2E when containers available
- WA-08 media outbound + WA-05/WA-11 UI polish (partial)
- Optional: adversarial close of `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Agent env sin Docker/Podman for live SQL/E2E
- Shared line still enqueues pet `process_inbound` for all non-fromMe inbound until inbox routing

### Process

- 2026-11-06: `areas-operators-admin` archived; merge PR #5
- 2026-11-06: `whatsapp-channel-core` adversarial PASS WITH GAPS, archived; merge PR #6

## Session Continuity

Last session: 2026-11-06
Stopped at: Archive + merge WA; next `/director` `mesa-entrada-inbox`
Resume file: `tmp/mesa-entrada-inbox-deferred-scope.md`
