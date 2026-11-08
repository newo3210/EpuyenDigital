# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 6 — `chatbot-llm` (plan ready; apply waits for approval)

## Current Position

Phase: 1–5 on branch `cursor/tareas-notas-3654` (awaiting merge to `main`)  
Plan: OpenSpec `chatbot-llm` drafted on `cursor/chatbot-llm-3654`  
Status: Phase 5 archived. Phase 6 plan-only; no production code until human “adelante”.  
Last activity: 2026-11-08 — Phase 6 OpenSpec plan

Progress: [█████████░] Phase 5 archived on PR; Phase 6 plan in progress

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (reconcile-foundation-to-main, areas-operators-admin, whatsapp-channel-core, mesa-entrada-inbox, pobladores-ficha, tareas-notas-trazabilidad)
- Average duration: -
- Total execution time: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [2026-11-08 merges]: PR #9 then PR #8 into main as `6c45c82`.
- [2026-11-08 Phase 5]: Task transitions SECURITY DEFINER; external contacts bypass citizen stub; sealed notes immutable.
- [2026-11-08 archive]: Phase 5 archived PASS WITH GAPS (mentions/task_files + NO_DOCKER).

### Pending Todos

- Merge PR #10 (`cursor/tareas-notas-3654`) when ready
- Phase 6 OpenSpec plan (BOT) — apply waits for human approval
- Live `supabase db reset` / curl / browser when containers are available
- WA-08 media outbound and WA-11 send_mode chooser

### Blockers

None for planning Phase 6. Apply of BOT waits for human “adelante”.
