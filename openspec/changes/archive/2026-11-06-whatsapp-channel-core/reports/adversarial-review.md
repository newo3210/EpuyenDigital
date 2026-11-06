# Adversarial review — whatsapp-channel-core

**Scope:** OpenSpec change `whatsapp-channel-core` · PR [#6](https://github.com/newo3210/EpuyenDigital/pull/6) · branch `cursor/whatsapp-channel-core-0e30` · base `origin/main`  
**Reviewer:** independent adversarial pass (did **not** implement apply)  
**Date:** 2026-11-06  
**Sources:** `proposal.md`, `design.md`, `tasks.md`, `specs/**`, `reports/verify-mechanical.md`, `reports/acceptance-matrix.md`, step 6.2–6.4 reports, `git diff origin/main...HEAD` (`d911549`), migration `20261107010000_whatsapp_channel_core.sql`, webhook/inbound/outbound/lines/composer features

## Spec and task alignment

| Claim | Reality |
|---|---|
| WA-01..12 channel core | Channel schema + inbound harden + text composer largely present; **WA-08 media outbound** honestly unchecked; **WA-05/WA-11** checkboxes overstate vs product wording |
| Secrets ciphertext + deny authenticated | Ciphertext path + `REVOKE` exist; **seed still plaintext**; **list UI reads secrets table with user JWT after REVOKE** |
| Webhook never open without secret (WA-03) | Persist/ACK paths verify secret; **ignored normalize short-circuit returns 200 before auth** |
| Conversations upsert + pet coexistence | Upsert + fromMe skip `process_inbound` look correct in unit tests; **citizen insert race** unhandled; live pet E2E **BLOCKED** (NO_DOCKER) |
| `send_mode` on every outbound | Shared `decideSend` used by composer + worker `send_outbound`; **no admin UI** despite WA-11 wording |
| Tasks 6.3/6.4 done | Checked with honest **NO_DOCKER** gap reports — acceptable as gaps, not as live proof |
| Mechanical / acceptance | Both already **PASS WITH GAPS**; live stack unproven |

**Acceptance that must be true for archive (from specs):**

1. Missing/wrong webhook secret → unauthorized/forbidden; no persist/enqueue  
2. Idempotent `(line_id, external_id)`; ignore group/broadcast/newsletter  
3. Conversation uniqueness `(org_id, line_id, phone_normalized)` + `default_area_id`  
4. Media inbound download job; location on message only (not citizen GPS)  
5. `@lid` resolve or safe ignore; pushName/avatar on stub  
6. `fromMe` → outbound, no bot drive  
7. Encrypted secrets not echoed; authenticated cannot read secrets table  
8. Admin line CRUD + connection test; non-admin denied  
9. Composer text + `dry_run` / allowlist / production guard  
10. Delivery ACK updates outbound `delivery_status`

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Blocker** | line-admin / secrets | **`/settings/lines` breaks after migration:** `listWhatsappLines` → `secretFlags()` selects `whatsapp_line_secrets` with the **authenticated** SSR client, while migration `REVOKE ALL … FROM anon, authenticated`. Query fails → page throws; admin cannot configure lines. Pre-REVOKE, RLS-with-no-policies already returned empty flags; REVOKE turns soft wrongness into hard failure. | `whatsapp-lines.ts` `secretFlags` + `listWhatsappLines`; `settings/lines/page.tsx` uses `createServerSupabase()`; migration lines 59–61; `migration-sql.test.ts` asserts revoke | **Code:** load presence flags via service-role helper or security-definer RPC returning booleans only (never ciphertext). Keep REVOKE. **Tests:** integration/unit proving list works under revoke. |
| **Blocker** | line-admin / multi-tenant | **Cross-org credential IDOR on “Probar conexión”:** `testConnectionAction` calls `loadDecryptedLineCredentials(admin, lineId)` with **service role** and **no `org_id` / ownership check**. Any authenticated admin who can guess/obtain another org’s `line_id` decrypts that line’s API key + webhook secret server-side and probes that Evolution instance. Status update is RLS-bound, but credential use already happened. | `features/whatsapp-lines/actions.ts` `testConnectionAction`; `loadDecryptedLineCredentials` selects by `line_id` only | **Code:** resolve line under caller RLS (or `eq('org_id', operator.orgId)`) **before** decrypt; refuse foreign `line_id`. Same guard on any admin secret write path. **Tests:** cross-org lineId denied. |
| **Major** | webhook / WA-03 | **Auth bypass on ignore path:** `route.ts` returns `{ ok: true, ignored: true }` for group/broadcast/invalid/etc. **before** line lookup or `verifyWebhookSecret`. WA-03 / product “nunca queda abierto” and inbound scenario “Missing secret rejected” are not met for those requests (200 without secret; reason codes probeable). Persist paths are protected. | `apps/web/src/app/api/webhooks/evolution/route.ts` lines 51–54 vs `ingestInboundEvent` secret check | **Code:** authenticate (instance → line → secret) before ignore short-circuit, or return 401 when secret missing even if payload would be ignored. **Tests:** group payload without secret → 401/503, no side effects. |
| **Major** | secrets / encryption | **Missing `CREDENTIALS_ENCRYPTION_KEY` with ciphertext → unhandled webhook failure:** `resolveWebhookSecret` throws `CREDENTIALS_ENCRYPTION_KEY_MISSING` inside `findLineByInstance`; route has no catch → **HTTP 500** instead of fail-closed 503 `SECRET_NOT_CONFIGURED`. After admin saves ciphertext, losing the key bricks inbound. Seed still uses **plaintext** `webhook_secret`, so local dry_run can mask the prod failure mode. | `supabase-inbound-store.ts` `resolveWebhookSecret`; seed.sql / `seed.ts` plaintext upsert; `.env.example` empty key | **Code:** catch key/decrypt errors → 503 + no persist; optionally refuse boot if ciphertext rows exist without key. **Seed/spec:** encrypt seed secret when key present, or document legacy exception in delta spec. **Tests:** ciphertext + missing key → 503. |
| **Major** | inbound / races | **Citizen stub race can 500 first-contact webhooks:** `upsertCitizenStub` select-then-insert without handling `citizen_phones` unique `(org_id, phone_normalized)` conflicts (unlike conversation insert which re-reads on race). Concurrent first messages for one phone → unique violation → thrown error → Evolution retry noise; orphan `citizens` rows possible. | `supabase-inbound-store.ts` `upsertCitizenStub` vs `upsertConversation` race branch | **Code:** on unique violation, re-select phone → citizen (same pattern as conversations). **Tests:** concurrent stub creation. |
| **Major** | outbound | **Evolution send before persist (composer production):** `sendOperatorText` calls `sendViaEvolution` then `persistOutbound`. Success + DB failure ⇒ WhatsApp delivered with no row (until possible `fromMe` echo). Inverse of “record then send”. | `features/outbound/send-text.ts` production branch | **Code:** persist `pending`/`sending`, then Evolution, then update `sent`/`failed` with `external_id`. **Tests:** Evolution ok + persist fail path. |
| **Major** | RLS / messages | **Org-wide authenticated INSERT/UPDATE on `conversations` and `messages`:** migration adds policies allowing any org member to forge/alter threads and message rows via the user JWT. Composer already persists with **service role**, so these write policies are unnecessary privilege for this change. Design defers *area* RLS, not “anyone can INSERT messages”. | migration lines 255–280; `outbound/actions.ts` uses `createAdminSupabase()` for insert | **Code/spec:** drop authenticated INSERT/UPDATE on messages (and tighten conversations writes) for this change; keep SELECT org-scoped; document inbox follow-up for area RLS. **Tests:** operator JWT cannot insert message directly. |
| **Major** | requirements honesty | **WA-11 marked done without admin send_mode chooser;** guard-only matches outbound *delta* spec but not product WA-11 (“Admin puede elegir el modo…”). **WA-05** checked while thread UI only shows `[kind]` / body — no media render despite “se ven en el hilo” (note admits deferral; checkbox still `[x]`). Tasks 6.3/6.4 marked complete solely via documented blockers — OK if archive accepts gaps, but must not be read as live proof. | `.planning/REQUIREMENTS.md` WA-05/WA-11; `conversation-thread.tsx`; step 6.3/6.4 reports | **OpenSpec / planning:** leave WA-11/WA-05 partial or move UI claims to inbox; keep checkboxes honest. |
| **Minor** | media worker | Channel inbound enqueues `download_media` with `kind: "animal"`; worker stores **all images** under `animal-media/` even without `sessionId`. Mesa channel images pollute pet folder taxonomy. | `inbound-repository.ts` enqueue; `download-media.ts` folder choice | **Code:** use `whatsapp-media` unless pet `sessionId` present; use neutral kind for channel. |
| **Minor** | delivery ACK | No monotonicity: a late `sent` ACK can overwrite `delivered`/`read`. | `applyDeliveryAck` blind update | **Code:** only upgrade status rank. |
| **Minor** | idempotency | If persist succeeds and process crashes before `enqueueJob`, duplicate webhook returns `duplicate: true` and **never enqueues** `process_inbound` (lost bot drive). Pre-existing pattern, still real under retries. | `ingestInboundEvent` only enqueues on `inserted` | **Code:** enqueue-if-missing job, or outbox row. |
| **Minor** | `@lid` | Unresolved `@lid` ignored (good); no Evolution lookup API — resolution only when `remoteJidAlt` / `senderPn` present. Spec allows “when Evolution provides mapping”; OK but WA-06 easy to overread. | `normalize-evolution.ts` | **Spec:** clarify “no lookup client in this change”. |
| **Question** | archive / Docker | Live `db reset`, curl webhook, E2E browser all **BLOCKED**. Unit suite (613) + static SQL tests are surrogates only. Human must accept residual risk or re-run 6.3/6.4 on Podman host before archive. | step 6.2–6.4 + verify-mechanical | **Process:** host re-verify or explicit human waiver. |
| **Question** | shared line + pet | Every non-`fromMe` inbound still enqueues `process_inbound` (pet machine) on the shared Mesa/Inspectoría line. Channel visibility is additive; product may not want Mesa chats driving registration — deferred to inbox routing? | `ingestInboundEvent` + design D8 | Confirm with product before archive. |

### Strengths that mitigate (only where they close a hunted risk)

- Persist/ACK paths use `verifyWebhookSecret` fail-closed (503 if unset, 401 mismatch); unit coverage in `inbound-repository.test.ts`.  
- `fromMe` persists outbound and skips `process_inbound` (tested).  
- Message idempotency via `ON CONFLICT (line_id, external_id)` + duplicate handling.  
- Conversation unique race re-read exists (citizen race does not).  
- Location not written to `citizens` lat/lng in inbound store.  
- Shared `decideSend` used by panel composer and worker outbound.  
- AES-GCM helpers refuse missing/invalid key (no service-role key fallback).  
- Docker/live gaps and text-only composer are **documented** in verify + PR (reduces silent overclaim on WA-08).

## Verdict

**FAIL**

At least two **Blockers** (lines admin broken under secrets REVOKE; cross-org decrypt on connection test) and several **Majors** (webhook pre-auth ignore, encryption-key failure mode, citizen race, send-before-persist, messages write RLS, requirements overclaim) must be fixed or explicitly waived with spec amendments before archive.

**Archiving is not advisable** in the current state.

## Recommended next steps (before archive)

1. Fix `secretFlags` / list path to use service-role or RPC booleans; prove `/settings/lines` loads under REVOKE.  
2. Bind all service-role credential loads to caller `org_id` (test connection + secret upsert).  
3. Require webhook secret before ignore responses (or amend WA-03 / inbound spec if intentional).  
4. Map credentials decrypt failures to 503; align seed with ciphertext when key present.  
5. Harden citizen upsert race; persist-then-send on composer; tighten messages RLS writes.  
6. Reconcile WA-05/WA-11 checkboxes with deferred UI.  
7. Re-run adversarial after fixes; optionally run 6.3/6.4 on a container host.  
8. Human OK only after **PASS** or **PASS WITH GAPS** with blockers closed.
