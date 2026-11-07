# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 3 — `mesa-entrada-inbox` (implemented on branch; pending director verify/adversarial/archive)

## Current Position

Phase: 1 Fundación + Phase 2 WhatsApp channel + Phase 3 inbox triage on feature branch  
Plan: OpenSpec `mesa-entrada-inbox` **implemented 2026-11-07** (tasks 1–5; §6 director open)  
Status: Claim/delegate RPCs, area RLS, queue UI, realtime, SLA, dual coords, pet gate on `cursor/mesa-entrada-inbox-0e30`  
Last activity: 2026-11-07 — implementer apply INB-01..15

Progress: [██████░░░░] ~45% (foundation + areas + WA channel + inbox triage code)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 archived; 1 inbox in progress
- Average duration: -
- Total execution time: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [2026-11-07 inbox]: SQL transitions + CLAIM_CONFLICT; dual inquiry coords; pet process_inbound gated to Inspectoría or open session; SLA business hours with calendar fallback; realtime postgres_changes
- [2026-11-06 areas]: Temp password once; admin-only writes; last-admin + advisory lock; email on profiles; SLA columns; default area swap
- [2026-11-06 WA]: Channel before inbox; conversations; encrypted secrets; shared line default Mesa

### Pending Todos

- Director: mechanical verify + acceptance matrix + adversarial + human OK → archive
- Live `supabase db reset` / curl RPC / E2E when Docker available
- Phase 4 pobladores; Phase 5 tasks; Phase 6 bot RAG
- WA-08 media outbound

### Blockers/Concerns

- Agent env sin Docker/Podman for live SQL/E2E (honest NO_DOCKER reports)
- Pet gate changes prior “always enqueue process_inbound” behavior on Mesa without session

### Process

- 2026-11-06: `whatsapp-channel-core` archived; merge PR #6
- 2026-11-07: `mesa-entrada-inbox` implementer complete tasks 1–5

## Session Continuity

Last session: 2026-11-07
Stopped at: Implementer push; await director §6
Resume file: `openspec/changes/mesa-entrada-inbox/`
