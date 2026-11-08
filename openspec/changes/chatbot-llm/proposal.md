## Why

Tasks, notes, and the inbox queue exist. Neighbors still get no automatic official answer: every text waits for a human or hits the Inspectoría pet state machine on the shared line. Phase 6 adds the municipal RAG chatbot so routine questions cite official documents, hand off cleanly when confidence is low, and stay silent while an operator owns the thread.

Roadmap: **Phase 6 — Chatbot LLM** · Requirements: **BOT-01..BOT-13**.

## What Changes

- Admin knowledge base: upload PDF/text/FAQ, chunk + embed, reindex, activate/deactivate documents.
- Worker `bot_reply` decision path: privacy notice, business hours, RAG answer with citations, clarification once, handoff with reason, silent when paused/owned.
- Classification (topic, urgency, suggested area) and confirmed field extraction into the citizen ficha (`source = bot`).
- Media understanding: image/PDF summary as a conversation note; audio transcription used as query text.
- Optional outbound of official files already in the knowledge/storage catalog when the answer calls for them.
- Global bot pause (`org_settings.bot_paused`) plus an emergency env kill switch.
- Operator-visible `bot_runs` (sources, confidence, decision) on the thread.
- Coexistence with the Inspectoría pet registry on the same WhatsApp line without gating `process_inbound` by area.

## Capabilities

### New Capabilities

- `knowledge-base`: document upload, chunking, embeddings, reindex, admin UI.
- `bot-decision`: reply / clarify / handoff / silent rules, privacy, hours, citations, file send.
- `bot-enrichment`: classification, confirmed field extraction, media summary notes, audio transcription.
- `bot-runs`: durable decision log visible to operators.

### Modified Capabilities

- `whatsapp-inbound`: after citizen persist, also enqueue `bot_reply` when the mesa bot is eligible (without dropping pet `process_inbound`).
- `conversation-ownership`: claim/resolve transitions MUST pause/resume `bot_state` and write `BOT_PAUSED` / `BOT_RESUMED` when required.
- `whatsapp-outbound`: bot and system sends use the existing send_mode path with `sender_kind = bot` / `system`.
- `notes`: allow `bot_summary` notes created by the worker (service role / seal when required).

## Impact

- Migration: `knowledge_documents`, `knowledge_chunks` (pgvector), `bot_runs`, enums (`bot_decision`, `handoff_reason`), org settings for privacy/hours copy if still pending.
- Worker: new jobs (`bot_reply`, `index_document`, `transcribe_audio`, `summarize_media`); LLM + embedding clients; pet flow unchanged when a registration session is active.
- `apps/web`: admin knowledge UI; thread bot-run panel; global pause control for admin.
- Root docs: `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, `docs/data-model.md`, `docs/flows.md`.
- Live Docker / curl / browser remain honest gaps when unavailable.

## Deferred (recorded)

- OPS metrics dashboards (Phase 7).
- WA-08 panel media composer and WA-11 send_mode chooser UI.
- Fine-tuning / private model hosting.
- Meta Cloud API.
