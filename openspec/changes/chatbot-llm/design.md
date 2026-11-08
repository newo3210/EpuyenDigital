## Context

Inbox, citizens, and tasks are live. The shared line still runs Inspectoría `process_inbound` for every non-fromMe citizen message. `docs/flows.md` already describes `bot.reply`, RAG, handoff, and `bot_state`. `org_settings.bot_paused` exists; knowledge tables and `bot_runs` do not. Pet vision LLM already lives in the worker.

## Goals / Non-Goals

**Goals:**

- Admin loads official docs; the bot answers only from that corpus and cites sources.
- Low confidence, sensitive topics, or “quiero hablar con alguien” hand off once to the queue with a reason and suggested area.
- Human claim pauses the bot; resolve resumes it when global pause is off.
- Audio becomes text; images/PDFs leave a `bot_summary` note.
- Every decision is stored in `bot_runs` for the operator.
- Pet registration keeps working on the same line.

**Non-Goals:**

- OPS dashboards (Phase 7).
- Panel media send (WA-08) and send_mode chooser UI (WA-11).
- Replacing Evolution with Meta Cloud API.
- Training a municipal fine-tune.

## Decisions

### D1 — Two jobs on one line (pet + mesa)

Keep enqueueing `process_inbound` for citizen inbound (existing invariant). Also enqueue `bot_reply` for the same message when eligible.

`bot_reply` **exits silent** when any of:

1. `BOT_KILL_SWITCH=1` or `org_settings.bot_paused`
2. conversation has a human owner or `bot_state` in (`paused`, `handoff`)
3. an open Inspectoría registration session exists for that phone/line
4. phone is an external contact (already bypassed before persist)

Pet flow does not call RAG. Mesa bot does not advance pet steps. Area labels stay human-only; we still do **not** gate `process_inbound` by area.

### D2 — Knowledge and embeddings

`knowledge_documents` + `knowledge_chunks` with `vector` (pgvector). Chunk on index job; store embedding model id in metadata. Retrieval: top-k cosine over active chunks for the org (and optional `area_id` filter). Admin reindex rebuilds chunks. Invalid/expired docs (`valid_until`, `is_active`) are excluded from retrieval.

### D3 — Decision log is source of truth

Every `bot_reply` attempt inserts `bot_runs` (answered / asked_clarification / handoff / silent) with sources, confidence, model, tokens, latency. Operators read runs on the thread. No client INSERT/UPDATE/DELETE on `bot_runs`.

### D4 — Handoff once per queue episode

On handoff: set `bot_state = handoff`, ensure conversation is in the queue (`new` / unowned as today), write conversation event, send **one** citizen ack per episode (CRM bug fix). Suggested area is advisory for operators; it does not auto-change `area_id` without a human (or an explicit later product decision).

### D5 — Pause / resume with ownership

`claim_conversation` / `ensure_owner_for_reply` set `bot_state = paused` + `BOT_PAUSED` when moving to human ownership. `resolve_conversation` sets `bot_state = active` (unless global pause) + `BOT_RESUMED`. Support remains read-only.

### D6 — Field extraction needs confirmation

Proposed name/DNI/address land in `bot_runs.extracted_fields` and a confirmation WhatsApp prompt. Only an explicit affirmative reply in the next turn writes via a definer path that marks `field_sources = bot` (manual still wins via the existing guard).

### D7 — Media

- Audio: `transcribe_audio` job → text used as the query for the same or next `bot_reply`.
- Image/PDF: `summarize_media` → `create_note`/`seal` path with `kind = bot_summary` on the conversation (service role).
- Official file send: only paths already stored for knowledge docs; still passes `decideSend`.

### D8 — Paths

| Layer | Paths |
|---|---|
| Presentation | `(panel)/settings/knowledge`, thread bot-runs panel, admin bot pause |
| Application | `features/bot/**`, `features/knowledge/**` |
| Worker | `jobs/bot-reply`, `index-document`, `transcribe-audio`, `summarize-media` |
| Infrastructure | repositories + embedding/LLM clients |
| Database | migration after tareas, pgTAP + Vitest SQL contracts |

### D9 — Security

Knowledge upload admin-only. Embeddings and LLM keys stay server-side. Bot never invents policy outside retrieved chunks; if retrieval is empty → handoff `low_confidence`. Redact PII in worker logs.

## Risks / Trade-offs

- Dual jobs can double-message if pet and mesa both speak: mitigated by session-active silent rule and careful welcome/privacy ordering.
- Embedding/LLM cost and latency: cap tokens; dry_run still persists outbound as simulated.
- pgvector availability locally: document `NO_DOCKER` / extension gap honestly.
- Suggested area auto-assign would surprise operators; keep advisory in v1 of this change.
