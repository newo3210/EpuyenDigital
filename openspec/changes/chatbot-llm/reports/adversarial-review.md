# Adversarial review — chatbot-llm (Phase 6)

**Scope**: OpenSpec change `chatbot-llm` on branch `cursor/chatbot-llm-3654`  
**Reviewer posture**: independent (writer ≠ reviewer); try to break, not rubber-stamp  
**Date**: 2026-11-08  

**Sources**:

- Specs: `openspec/changes/chatbot-llm/{proposal,design,tasks}.md` + `specs/**`
- Implementation: `supabase/migrations/20261108200000_chatbot_llm.sql`, `supabase/tests/010_chatbot_llm.test.sql`, `packages/shared/src/domain/bot-decision.ts`, `worker/src/jobs/{bot-reply,index-document,transcribe-audio,summarize-media}.ts`, inbound dual enqueue, knowledge UI, `bot-runs` panel
- Prior inbox migration (claim/resolve bot_state): `supabase/migrations/20261107120000_mesa_entrada_inbox.sql`
- Verification artifacts: `openspec/changes/chatbot-llm/reports/2026-11-08-*`, `reports/*chatbot*`

---

## Spec and task alignment

| Must-be-true | Status |
|---|---|
| Dual jobs: `process_inbound` + `bot_reply`; do **not** gate inbound by area | Met (inbound always enqueues both; no area gate) |
| Do **not** auto-set `conversations.area_id` from bot | Met (`suggested_area_id` hard-null; no area update in `bot_reply`) |
| Silent on kill switch / org pause / human owner / `paused`\|`handoff` / open pet session | Partially met in pure `decideBotReply`; composition bugs undermine audio + race |
| `SECURITY DEFINER` + `search_path ''` + `auth.uid()` on client RPCs | Met for admin/list RPCs; service helpers correctly service_role-only |
| `bot_runs` append-only for clients | Met (revoke INSERT/UPDATE/DELETE + pgTAP intent) |
| Honest `NO_DOCKER` for live pgTAP/curl/browser | Met in 5.2–5.4 reports |
| Knowledge admin: upload / activate / reindex; PDF+text+FAQ | **Gap** — text-only UI; no activate/deactivate/reindex controls |
| Enrichment: classification + confirmed field extraction + real media pipeline | **Gap** — stubs / missing paths |
| Outbound `sender_kind = bot` | **Gap** |
| Resolve resumes bot only when org not globally paused | **Gap** |
| Acceptance matrix honest vs code | **Overstates PASS** |

---

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Blocker** | Worker / inbound / audio | Inbound always enqueues `bot_reply` **and** `transcribe_audio`. Audio bodies are typically empty; `decideBotReply` with empty text skips clarification and **hands off** with `empty_knowledge`, then `markHandoff` sets `bot_state = handoff`. The later transcribed `bot_reply` is forced **silent**. Citizen audio never gets a mesa answer. | `inbound-repository.ts` dual enqueue; `transcribe-audio.ts` re-enqueues `bot_reply`; `bot-decision.ts` empty→handoff; `supabase-store.markHandoff` | **Code**: do not enqueue `bot_reply` for audio until transcription completes (or make `bot_reply` no-op/wait when `kind=audio` and body empty). Clear/avoid premature handoff. Add regression test for audio→transcript→answer. |
| **Blocker** | Spec honesty / enrichment | Tasks mark field-extraction path done; `bot-enrichment` requires confirm-then-write with `field_sources = bot` and manual-wins. `bot_pending_fields` exists in SQL but **no worker path** proposes fields, prompts confirmation, or writes citizen fields. | Migration columns only; `bot-reply.ts` never touches pending fields / citizen updates; no definer write path in this migration | **Code + tests**: implement D6 confirmation turn + definer write respecting `field_sources`; or reopen tasks/spec if deferred (do not claim done). |
| **Major** | Knowledge UI / BOT admin | Task 3.1 and knowledge-base spec require upload, **activate/deactivate**, **reindex**, and PDF/text/FAQ. UI is text textarea only; `is_active` hardcoded `true`; no reindex/deactivate actions; no PDF/storage upload. | `knowledge-admin.tsx`, `actions.ts` (`p_source_kind: 'text'`, `p_is_active: true`) | **Code**: wire activate toggle + reindex RPC/job; support PDF/storage_path path or narrow the delta spec explicitly. |
| **Major** | Resolve / D5 | `resolve_conversation` always sets `bot_state = active` + `BOT_RESUMED` with **no** check of `org_settings.bot_paused`. Spec + design: resume only when global pause is off. Chatbot migration did not extend resolve. | `20261107120000_mesa_entrada_inbox.sql` resolve body; conversation-ownership spec | **SQL**: in `resolve_conversation`, if `bot_paused` then keep `bot_state` paused (or set paused) and skip `BOT_RESUMED` (or emit pause-preserving event). Add pgTAP case. |
| **Major** | Outbound contract | Bot answers enqueue generic `send_outbound`; `persistOutbound` never sets `messages.sender_kind = 'bot'`. Violates whatsapp-outbound delta. | `bot-reply.ts` enqueue; `supabase-store.persistOutbound` insert without `sender_kind` | **Code**: pass/persist `sender_kind: 'bot'` on bot-originated outbound (and cover dry_run). |
| **Major** | bot_runs panel | Task 3.2 / operators must see **sources**. Repository maps `sources`; UI never renders them. | `bot-runs-panel.tsx` vs `listBotRuns` | **Code**: render source titles/ids from `run.sources`. |
| **Major** | RAG / D2 / task 2.3 | `knowledge_chunks.embedding` never populated; no embedding/chat LLM client used by mesa bot. Index job is text-split only; retrieval is `pg_trgm`/`ilike` fallback. Confidence threshold (0.55) is poorly matched to trigram scores → chronic clarify/handoff. | `index-document.ts`, `replace_knowledge_chunks` (no embedding), `search_knowledge_chunks` | **Code**: embed on index + cosine retrieval, **or** retune threshold/scoring for trigram and document the intentional MVP in design/tasks (acceptance matrix currently implies fuller RAG). |
| **Major** | Classification | Proposal/tasks expect topic/urgency/suggested area on runs. Worker always inserts `suggested_area_id: null` and never classifies. | `insertBotRun` call site | **Code**: classify on handoff/answer, **or** mark deferred in proposal/tasks/acceptance matrix. |
| **Major** | Dual-job race (pet) | `process_inbound` and `bot_reply` run concurrently. Open pet session may not exist yet when mesa checks → bot can speak on the same turn that starts registration (design risk incompletely mitigated). | Parallel enqueue in inbound; silent rule depends on session row | **Code**: serialize per phone, or have `bot_reply` wait/retry after inbound lock, or enqueue `bot_reply` only after inbound completes when pet registry enabled. **Tests**: concurrent pet-start vs bot_reply. |
| **Major** | bot_runs completeness | Spec: every `bot_reply` execution inserts exactly one run. Handler returns early when `!ctx.mesaBotEnabled` with **no** insert. | `bot-reply.ts` lines 15–16 | **Code**: insert `silent`/`paused` run before return, or skip enqueue when org mesa bot disabled. |
| **Major** | Handoff episode bookkeeping | Design D4: handoff should write a conversation event and queue cleanly. `markHandoff` only patches conversation columns (no `inbox_event`). | `supabase-store.markHandoff` | **Code**: emit handoff/queued event via existing event helper (service path). |
| **Major** | Media quality | `transcribe_audio` / `summarize_media` are stubs (reuse message body / URL string). Not real transcription/vision summary; acceptance matrix still paints media path as PASS at unit level. | `transcribe-audio.ts`, `summarize-media.ts` | **Code**: wire real providers **or** downgrade acceptance + tasks to “stub / deferred” with explicit gap. |
| **Major** | Docs / acceptance | Acceptance matrix marks knowledge UI, enrichment-adjacent items, and “PASS (code)” while activate/reindex/sources/field extraction/sender_kind are incomplete. Risks archiving on false greens. | `…acceptance-matrix.md` vs code | **OpenSpec/docs**: re-grade to FAIL/GAP per finding; do not archive until blockers cleared. |
| **Minor** | Knowledge UI | List shows status but no per-doc activate/reindex buttons; operators cannot heal `failed` index without re-upserting body. | `knowledge-admin.tsx` | **Code** follow-up. |
| **Minor** | Claim events | Spec: append `BOT_PAUSED` when previous state was not already paused. Claim always inserts event. | `claim_conversation` | **SQL** optional guard. |
| **Minor** | `search_knowledge_chunks` | User query interpolated into `ilike` without escaping `%`/`_`. Service-role only, but scores/matches can be broadened. | migration search function | **SQL**: escape LIKE wildcards. |
| **Minor** | Verification depth | Honest `NO_DOCKER` is correct; static Vitest SQL contract ≠ live RLS/pgvector proof. | 5.2–5.4 reports | Keep gap; run live before archive when Docker available. |
| **Question** | Privacy-first turn | First eligible message only sends privacy (`answered`) and does not answer the citizen question until the next turn. Spec allows “before other Q&A”; confirm product expects dropped first question content. | `decideBotReply` privacy branch | **Product/spec** confirm. |

### Constraints check (explicit)

| Constraint | Result |
|---|---|
| Dual jobs; silent rules listed | Dual enqueue yes; silent tree yes; **broken for audio + pet race** |
| Do not gate `process_inbound` by area | **OK** |
| Do not auto-set `conversation.area_id` from bot | **OK** |
| SECURITY DEFINER + `search_path ''` + `auth.uid()` (client RPCs) | **OK** |
| `bot_runs` append-only for clients | **OK** (static); live pgTAP NO_DOCKER |
| Honest NO_DOCKER | **OK** |

### Mitigations that hold

- Client write revocation on `bot_runs` / knowledge tables and admin-only upsert/pause RPCs are correctly shaped.
- Pure decision tests cover kill switch, pause, owner, handoff, pet silent, privacy once, clarify→low_confidence, handoff ack once.
- Docs call out coexistence and no area gating; 5.3/5.4 do not fake live curl/browser.

---

## Verdict (initial pass)

**FAIL** — superseded by **Re-audit** below.

At least one **Blocker** (audio dual-enqueue → premature handoff) plus multiple **Majors** were found on the first pass.

## Verdict (current)

**PASS WITH GAPS** — see Re-audit section.

---

## Recommended next steps (before archive)

1. Fix audio pipeline so `bot_reply` does not hand off on empty audio before transcription.
2. Implement or explicitly defer field extraction (D6) and re-open related tasks.
3. Extend `resolve_conversation` for `bot_paused`; set outbound `sender_kind = bot`; render `bot_runs.sources`.
4. Complete knowledge activate/reindex (and PDF or narrow spec); decide embeddings vs documented trigram MVP.
5. Add concurrency test for pet session vs `bot_reply`; insert silent run when mesa bot disabled.
6. Re-run unit suites; keep NO_DOCKER honesty until live DB available; refresh acceptance matrix to match reality.

### Exact fixes needed (for parent; not applied here)

1. **`apps/web/src/infrastructure/inbound-repository.ts`**: for `event.kind === "audio"`, enqueue `transcribe_audio` only (skip immediate `bot_reply`); keep `bot_reply` for text (and post-transcript).
2. **`packages/shared/src/domain/bot-decision.ts`**: treat empty `citizenText` as silent (or wait), never `empty_knowledge` handoff.
3. **`supabase/migrations/…` (new)**: replace `resolve_conversation` to respect `org_settings.bot_paused`; optional handoff event helper for worker.
4. **`worker/.../persistOutbound`**: accept and write `sender_kind`.
5. **`bot-runs-panel.tsx`**: display sources.
6. **Knowledge actions/UI**: activate + reindex; stop claiming PDF/FAQ until supported.
7. **Field extraction**: worker + definer RPC, or mark deferred in tasks/proposal/matrix.
8. **Acceptance matrix**: flip false PASSes to FAIL/GAP.

---

## Re-audit (post-fix) — 2026-11-08

**Branch**: `cursor/chatbot-llm-3654` (working tree + listed fixes)  
**Method**: re-read inbound, `bot-decision`, migration resolve/knowledge RPCs, `bot-reply`, outbound `senderKind`, knowledge UI, tasks, acceptance matrix.

### Fix verification

| Claimed fix | Verified? | Evidence |
|---|---|---|
| Audio: no dual `bot_reply`; only `transcribe_audio` then later `bot_reply` | **Yes** | `inbound-repository.ts` audio branch; unit test `enqueues transcribe_audio without immediate bot_reply` |
| Empty `citizenText` → silent | **Yes** | `bot-decision.ts` early silent; unit test covers `"   "` |
| `resolve_conversation` respects `bot_paused` | **Yes** | chatbot migration replace sets `bot_state=paused` and skips `BOT_RESUMED` when paused |
| `senderKind=bot` persisted | **Yes** | job schema + `bot-reply` enqueue + `persistOutbound` writes `sender_kind` |
| Sources in panel; activate/reindex RPCs+UI | **Yes** | `bot-runs-panel.tsx`; `set_knowledge_document_active` / `reindex_knowledge_document` + admin UI |
| `extractProposedFields` → `bot_runs`; confirm→write deferred | **Yes** | proposed fields logged; tasks 2.3/2.4 reopened; matrix GAP |
| Matrix re-graded; mesaBot silent run; pet re-check | **Yes** | honest GAPs; early `insertBotRun` when `!mesaBotEnabled`; 75ms pet re-check |

### Prior blockers

- Audio empty-body handoff: **cleared**
- Field extraction claimed done while absent: **cleared as honesty issue** (now deferred MVP partial / GAP)

### Remaining majors / gaps (tracked — not archive blockers if product accepts MVP)

| Severity | Item | Notes |
|---|---|---|
| Major (deferred) | D6 confirm→citizen write | Proposed fields only; no affirmative turn / definer write / manual-wins enforcement in this change |
| Major (deferred) | Embeddings + chat LLM RAG | Trigram/text MVP; `embedding` unused; threshold tuned for cosine not trigram |
| Major (deferred) | Classification topic/urgency/suggested area | Not populated; area_id still not auto-set (constraint OK) |
| Major (deferred) | Real STT / media vision summary | Stub jobs remain |
| Major (deferred) | PDF/FAQ upload | Text corpus MVP; PDF deferred in tasks/matrix |
| Major (residual) | Pet/`bot_reply` race | 75ms re-check is best-effort; not a hard per-phone serialize |
| Major (residual) | Handoff conversation event | `markHandoff` still patches columns only; no `inbox_event` |
| Minor / env | Live pgTAP / curl / browser | Honest `NO_DOCKER` GAP |

### Constraints (re-check)

| Constraint | Result |
|---|---|
| Dual jobs; silent rules | **OK** (audio sequenced correctly) |
| Do not gate `process_inbound` by area | **OK** |
| Do not auto-set `area_id` from bot | **OK** |
| SECURITY DEFINER + `search_path ''` + `auth.uid()` on client RPCs | **OK** (incl. activate/reindex) |
| `bot_runs` append-only for clients | **OK** (static) |
| Honest NO_DOCKER | **OK** |

### Re-audit verdict

**PASS WITH GAPS**

Blockers from the first pass are addressed or honestly deferred. Remaining items are deferred majors / residual soft risks already reflected in tasks 2.3–2.4 and the acceptance matrix. Archiving still requires human OK on the documented MVP gaps; live DB verification remains outstanding when Docker is available.

### Recommended before archive (non-blocking if gaps accepted)

1. Product sign-off on deferred D6 / embeddings / PDF / STT.
2. Prefer per-phone job serialization over 75ms sleep for pet coexistence.
3. Emit handoff/queued `inbox_event` from worker markHandoff path.
4. Run live pgTAP + smoke curl/browser when environment allows; keep matrix GAP until then.
