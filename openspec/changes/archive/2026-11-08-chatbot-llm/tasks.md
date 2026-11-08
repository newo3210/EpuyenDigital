## 0. Branch

- [x] 0.1 Branch `cursor/chatbot-llm-3654` from `cursor/tareas-notas-3654` (this plan commit). No production code before this artifact is approved.

## 1. Database — knowledge, bot_runs, pause hooks (TDD)

- [x] 1.1 Failing Vitest SQL contract on the migration: tables, pgvector chunks, bot_runs append-only, revoke authenticated writes, claim/resolve bot_state hooks.
- [x] 1.2 Migration: `knowledge_documents`, `knowledge_chunks`, `bot_runs`, enums, privacy/out-of-hours settings columns if still missing, indexes.
- [x] 1.3 Definer/admin RPCs for knowledge upsert, reindex enqueue, list; service-role helpers for bot_runs insert and bot_summary notes.
- [x] 1.4 Extend claim / ensure_owner / resolve to set `bot_state` and `BOT_PAUSED` / `BOT_RESUMED` per design D5.
- [x] 1.5 pgTAP `010_chatbot_llm.test.sql`: admin-only knowledge write, support forbidden, bot_runs no client write, retrieval excludes expired.
- [x] 1.6 Unit tests pass; record live `supabase test db` or honest `NO_DOCKER` / extension gap.

## 2. Worker — bot_reply and media (TDD)

- [x] 2.1 Job payloads: `bot_reply`, `index_document`, `transcribe_audio`, `summarize_media`.
- [x] 2.2 `bot_reply` decision tree (kill switch, pause, pet session silent, privacy, hours, RAG, clarify once, handoff once).
- [ ] 2.3 (MVP partial — see acceptance matrix gaps) Embedding + chat LLM clients; dry_run outbound via existing send path with `sender_kind = bot`.
- [ ] 2.4 (MVP partial — see acceptance matrix gaps) Transcription and media summary jobs; confirmed field extraction path.
- [x] 2.5 Inbound enqueue of `bot_reply` alongside `process_inbound` without breaking external bypass or pet sessions.

## 3. Panel UI

- [x] 3.1 (text + activate/reindex; PDF deferred) Admin `/settings/knowledge` upload, list, activate, reindex. Global bot pause control.
- [x] 3.2 Thread panel lists `bot_runs` (decision, confidence, sources). Support read-only.
- [x] 3.3 Presentation has no Supabase imports; copy in `es-AR`.

## 4. Root docs

- [x] 4.1 Update `ARCHITECTURE_SDD.md` (English): knowledge, bot_reply coexistence with pet, pause rules.
- [x] 4.2 Update `STUDENT_DECISION_LOG.md` (Spanish): why two jobs, why confirmation before bot field writes, why handoff ack once.
- [x] 4.3 Update `docs/data-model.md` and `docs/flows.md` marks for implemented bot/knowledge pieces.

## 5. Mandatory verification

- [x] 5.1 Unit tests for decision silent paths and dual-enqueue.
- [x] 5.2 Report `reports/YYYY-MM-DD-step-5.2-unit-test-and-db-verification.md` (include pgvector/NO_DOCKER honesty).
- [x] 5.3 Curl or documented blocker in `reports/YYYY-MM-DD-step-5.3-curl-manual.md`.
- [x] 5.4 Browser pass (knowledge upload + thread runs) or documented blocker in `reports/YYYY-MM-DD-step-5.4-e2e-browser.md`.
- [x] 5.5 Acceptance matrix from BOT-01..13. Do not archive in this task list.

## 6. Explicitly not in this change

- [x] 6.1 Do not build OPS metrics dashboards.
- [x] 6.2 Do not implement WA-08 panel media send or WA-11 send_mode chooser.
- [x] 6.3 Do not gate `process_inbound` by conversation area.
- [x] 6.4 Do not auto-overwrite `conversations.area_id` from bot classification.
