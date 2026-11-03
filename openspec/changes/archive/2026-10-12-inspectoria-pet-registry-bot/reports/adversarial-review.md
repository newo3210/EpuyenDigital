# Adversarial review — inspectoria-pet-registry-bot

**Date:** 2026-10-12  
**Reviewer role:** Independent (did not implement this change)  
**Scope:** OpenSpec change `inspectoria-pet-registry-bot` + branch `cursor/inspectoria-pet-registry-bot-4cd2` vs `origin/main`  
**Sources:**
- `openspec/changes/inspectoria-pet-registry-bot/{proposal,design,tasks}.md`
- `openspec/changes/inspectoria-pet-registry-bot/specs/{inspectoria-whatsapp-channel,pet-registration-conversation,animal-registry}/spec.md`
- Diff `origin/main...HEAD` (apps/web, worker, packages/shared, supabase, reports)
- Mechanical verify: `reports/verify-mechanical.md` (PASS WITH WARNINGS; live `test:db` not run)

**Mindset applied:** break assumptions on PII, webhook thinness, send-mode, ID generation races, vision failure, consent-before-PII, location required, horse not offered; hunt spec↔code drift and composition failures.

---

## Spec and task alignment

| Area | Spec / design expectation | Implementation reality |
|---|---|---|
| Webhook thin | Secret + Zod + persist/enqueue; no LLM/media/send | **Met** in `route.ts` (static import test present) |
| Consent before PII | No name/doc/address/location until accept | **Mostly met** in pure state machine; session payload only after accept |
| Location required | Native location only; text re-prompts | **Met** in state machine |
| Horse out of MVP | No Caballo / plantel options; species dog\|cat\|other | **Met** (menus, buttons, Zod, SQL CHECK) |
| Send-mode | Single entry; dry_run / allowlist / production | **Met** in `send-outbound` + `decideSend` |
| Vision failure | Retry once; animal stays active; `pending_manual` | **Met** (vision client retry + analyze_traits catch) |
| Municipal ID + counter | Atomic `{BARRIO}-{YYYY}-{SEQ5}` with `FOR UPDATE` | **SQL path met**; worker completion path **not** end-to-end transactional |
| Session lock | Design D4: `SELECT … FOR UPDATE` in transaction | **Not met** — plain select/upsert |
| Per-line webhook secret | Spec: line secret missing → 503; validate for Inspectoría line | **Not met** — only `env.WEBHOOK_SECRET`; `line.webhookSecret` loaded and ignored |
| Photos linked on complete | ≥1 `animal_photos` row; health_card optional kind | **Race + kind bugs** (see findings) |
| Returning citizen geo snapshot | Design D8: copy lat/lng onto animal | **Not met** for returning path (payload has no coords) |
| Confirm/update citizen | Spec: offer confirm/update data | **UI copy only** — any non-empty text advances; no parse/update |
| `fromMe` | Project backend-standards / flows: do not drive bot | **Not ignored** — can process own outbound as inbound |
| Live pgTAP / SQL tests | Tasks 4.x / 10.x marked done | **Not executed** in this environment (documented fallback) |

Tasks are all marked `[x]`, but several “done” items rest on memory-store Vitest paths that do not exercise the Supabase race/lock behavior the design claims.

---

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Blocker** | animal-registry / photos | **Completion does not wait for `download_media`.** Finish (`listo`) links only messages that already have `storagePath`. A fast “photo → listo” (or delayed Evolution download) yields an **active** animal with **zero** `animal_photos` rows while confirmation still includes the municipal ID. Spec scenarios “Photos linked” / “≥1 photo” are violated under realistic timing. E2E fixture drains jobs between photo and finish, so tests hide the race. | `worker/src/jobs/process-inbound.ts` (link loop gated on `storagePath`); `download-media.ts` async; `flow.test.ts` calls `drain` before `listo` | **Code:** gate completion until pending media jobs succeed (or fail with re-prompt); or complete only after storage paths present. **Tests:** adversarial timing case without mid-drain. |
| **Blocker** | animal-registry / idempotency | **Registration completion is not idempotent.** `complete_animal_registration` runs before session is persisted as `done`. Crash, worker retry, or a second finish message while session still shows `animal_photos` creates **another** animal + sequence. Design/backend-standards require idempotent handlers; animal uniqueness is only on `municipal_id`, not on “one completion per session.” | `process-inbound.ts` order: upsert citizen → RPC complete → … → `upsertSession(done)` last; no completion token / expected-step guard | **Code:** single SQL transaction (or RPC) that transitions session `animal_photos|completing → done` and inserts animal only if still incomplete; or store `completedAnimalId` and short-circuit. **Tests:** double-finish / crash-replay. |
| **Blocker** | design D4 / concurrency | **`lockSession` does not lock.** Design mandates `FOR UPDATE` on the session row inside a transaction. Supabase impl is a plain `select`; memory map has no mutex. Concurrent `process_inbound` for the same phone (Evolution retries, multi-worker) can interleave transitions and corrupt payload / double-complete. | `design.md` D4; `supabase-store.ts` `lockSession`; `memory-store.ts` `lockSession` | **Code:** `SELECT … FOR UPDATE` (RPC) wrapping transition + writes. **Tests:** concurrent inbound for one phone. |
| **Major** | inspectoria-whatsapp-channel / secret | **Per-line webhook secret is unused.** Spec: reject wrong/missing secret; fail closed when **line** has no secret. Route verifies only `process.env.WEBHOOK_SECRET`. `findLineByInstance` loads `whatsapp_line_secrets.webhook_secret` into `LineContext.webhookSecret`, but `ingestInboundEvent` never checks it. Seeded DB secret and env can diverge silently. | Channel spec scenarios; `route.ts`; `inbound-repository.ts`; `supabase-inbound-store.ts`; `seed.sql` | **Code:** after line resolve, require `line.webhookSecret` and constant-time compare (503 if null). Align env with seed or drop unused column from MVP and update **spec**. |
| **Major** | channel / fromMe | **`fromMe` inbound is processed as citizen input.** Normalized and stored; never ignored. Project `docs/backend-standards.md` / `docs/flows.md` require `fromMe` as outbound phone echo, not bot drive. Risk: operator typing on the linked handset advances/corrupts registration or loops with outbound. | `normalize-evolution.ts` sets `fromMe`; no filter in route/ingest/process-inbound | **Code:** ignore or persist-as-outbound without enqueue when `fromMe`. **Spec:** add explicit scenario if in MVP scope. |
| **Major** | animal-registry / health_card | **Health-card photos are linked as `kind: "animal"` (or never as health_card).** Every pending media id is linked with hardcoded `kind: "animal"` at completion. Supabase `getPendingAnimalIdForSession` always returns `null`, so mid-flow linking never runs with correct kind from the job payload. | `process-inbound.ts` link loop; `supabase-store.ts` `getPendingAnimalIdForSession` → `null`; job payload has `kind` | **Code:** persist photo kind per message id; link using that kind; implement session→animal pending correctly or only link after animal id exists with stored kinds. |
| **Major** | animal-registry / returning geo | **Returning-citizen animals omit location snapshot.** Design D8: copy citizen lat/lng onto animal at registration. Returning path starts animal steps without copying citizen coords into session payload; RPC gets `p_latitude/p_longitude` null. | `process-inbound.ts` start/returning; `completeAnimalRegistration` uses `payload.latitude` only | **Code:** hydrate payload from citizen row before complete (or SQL read citizen geo). **Tests:** second pet keeps non-null animal lat/lng. |
| **Major** | pet-registration-conversation / returning | **“Confirm/update my data” does not update data.** Spec: offer confirm/update. State machine `confirm_citizen` advances on any non-empty text and never parses corrections; i18n invites corrections that are ignored. | `state-machine.ts` `confirm_citizen`; `registration.ts` copy | **Code or spec:** implement structured update **or** narrow copy/scenario to “OK confirms only.” |
| **Major** | contracts | **`citizenUpsertSchema` is not enforced at the worker boundary.** Zod contract exists and is unit-tested in isolation; `upsertCitizenFromPayload` writes partial/nullable fields without parse. Incomplete payloads can create citizens missing required PII/geo/consent. | `packages/shared/src/contracts/citizen.ts`; `supabase-store.ts` / `memory-store.ts` upsert | **Code:** parse with `citizenUpsertSchema` (or returning-specific schema) before persist. |
| **Major** | channel / idempotency | **Missing Evolution message id fabricates a new `externalId`.** `cryptoRandomId()` breaks idempotency on redelivery when `key.id` is absent. Spec requires at-most-once per `(line_id, external_id)`. | `normalize-evolution.ts` `externalId` fallback | **Code:** ignore/503 invalid payloads without stable id; never invent ids for persist keys. |
| **Major** | verification | **SQL/pgTAP and live webhook↔worker bus not proven.** Tasks 4.x/10–12 marked complete with documented CLI/Podman absence. Counter races, species CHECK, private bucket, and shared job bus remain unproven on real Postgres. Mechanical verify already WARNED. | `tasks.md` notes; `verify-mechanical.md`; `supabase/tests/pet_registry_pgtap.sql` unrun | **Tests/ops:** run `supabase test db` (or CI job) before archive; do not treat memory Vitest as substitute for D4/D6 SQL claims. |
| **Minor** | PII / logs | Job failures use `redactForLogs`; worker boot `console.error` and persisted `messages.body` / `raw` still hold full phones and DNI text (expected for registry, but “application logs SHALL redact” is only partially met). | `consumer.ts`; `index.ts`; inbound persist `raw: params.event` | **Code:** redact console paths; avoid logging raw webhook bodies in prod. |
| **Minor** | consent UX | `parseConsentAccept` treats bare `si`/`1` as consent (broader than design’s “Acepto”). Low risk; can accidental-accept. | `menus.ts` | **Code or spec:** tighten keywords to match notice options. |
| **Minor** | municipal ID naming | Spec text says `BARRIO3` (3 letters) but design/SQL allow 3–4 (`CENT`). Behavior matches scenarios using `CENT`; naming only is inconsistent. | Spec vs `neighborhood_codes` check | **Spec:** rename to BARRIO3-4. |
| **Minor** | memory store | `getPendingAnimalIdForSession` returns last animal ignoring `sessionId` — can attach in-flight media to a prior pet in tests/local memory mode. | `memory-store.ts` | **Code:** return null until animal exists for that session (match Supabase). |
| **Question** | LID | Unresolved `@lid` without `senderPn`/`remoteJidAlt` may normalize lid digits into a fake `549…` session key. Spec only covers successful resolution. | `normalize-evolution.ts` `extractPhoneRaw` | Confirm product: ignore unresolved lid vs require alt. |
| **Question** | microchip | Spec mentions microchip as text field; state machine never asks. Design says optional. | conversation spec vs `state-machine.ts` | Confirm out of MVP chat or add step. |

---

## What held up under attack

These were checked and **did not** fail the stated scenarios (happy-path / unit evidence):

- **Webhook thinness:** route does not import vision, Evolution send, or media download.
- **Consent-before-PII (session machine):** decline/unclear keeps step `consent` without `fullName`/`documentId`.
- **Location gate:** text at `location` re-prompts; only `kind === "location"` advances.
- **Horse not offered:** `SPECIES_MENU_LINES` / buttons are Perro/Gato/Otro only; Zod + SQL reject `horse`.
- **Send-mode:** `decideSend` blocks dry_run and non-allowlisted; Evolution not called when blocked.
- **Vision failure:** invalid/thrown provider → `traits_status = pending_manual`; animal remains `active`; confirmation path independent of vision job.
- **SQL counter design (on paper):** `complete_animal_registration` uses insert-counter + `FOR UPDATE` + lpad SEQ5 + EPU fallback (unrun in this env).

---

## Verdict

**FAIL**

Archive is **not advisable** until the blockers (photo completion race, non-idempotent completion, session locking) and the majors that violate explicit channel/registry/conversation requirements (per-line secret, fromMe, health_card kind, returning geo, confirm/update, contract enforcement, external id, live SQL proof) are fixed or the OpenSpec artifacts are deliberately narrowed with human sign-off.

---

## Recommended next steps (before archive)

1. Make completion **wait for media** (or fail closed) and prove with a no-drain timing test.
2. Make completion **idempotent** under session `FOR UPDATE` (one animal per successful finish).
3. Wire **line webhook secret** (or update channel spec + drop dead column).
4. Ignore **`fromMe`** for bot transitions.
5. Fix **health_card** kind + **returning citizen** geo copy; enforce **citizenUpsertSchema** (or returning variant) at persist.
6. Stop inventing **externalId**; run **pgTAP / live DB** evidence and refresh step-10/verify reports.
7. Re-run adversarial review after fixes; keep writer ≠ reviewer.
