# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 6 archived on PR #11 — next roadmap slice (OPS / residuals) awaits direction

## Current Position

Phase: 1–6 on branch `cursor/chatbot-llm-3654` (PR #11 vs `main`)  
Plan: OpenSpec `chatbot-llm` archived as `2026-11-08-chatbot-llm`  
Status: Phase 6 apply + adversarial PASS WITH GAPS + archive OK  
Last activity: 2026-11-08 — archive chatbot-llm

Progress: [██████████] Phase 6 archived on PR

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (reconcile-foundation-to-main, areas-operators-admin, whatsapp-channel-core, mesa-entrada-inbox, pobladores-ficha, tareas-notas-trazabilidad, chatbot-llm)
- Average duration: -
- Total execution time: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [2026-11-08 merges]: PR #9 then PR #8 into main as `6c45c82`; PR #10 (tareas) merged to main.
- [2026-11-08 Phase 5]: Task transitions SECURITY DEFINER; external contacts bypass citizen stub; sealed notes immutable.
- [2026-11-08 archive]: Phase 5 archived PASS WITH GAPS (mentions/task_files + NO_DOCKER).
- [2026-11-08 Phase 6]: Dual jobs pet+mesa; trigram retrieval MVP; resolve respects `bot_paused`.
- [2026-11-08 archive]: Phase 6 archived PASS WITH GAPS (embeddings, D6 write, PDF/STT, NO_DOCKER).

### Pending Todos

- Merge PR #11 (`cursor/chatbot-llm-3654`) when ready
- Live `supabase db reset` / curl / browser when containers are available
- Residuals: embeddings/RAG LLM, D6 confirm→write, PDF knowledge, real STT/media summary
- WA-08 media outbound and WA-11 send_mode chooser
- Phase 7 OPS metrics (when directed)

### Blockers

None for archive. Live DB verification still blocked by `NO_DOCKER`.
