# Adversarial fixes — round 1 (whatsapp-channel-core)

**Date:** 2026-11-06  
**Branch:** `cursor/whatsapp-channel-core-0e30`  
**Source FAIL:** `reports/adversarial-review.md`  
**Scope:** Tasks §9.1–9.6 (Blockers + Majors); optional cheap Minors included

## Summary

Closed both Blockers and all Majors from the first adversarial pass. `npm test` → **620 passed** (was 613).

## 9.1 Blocker — secretFlags under REVOKE

| Item | Detail |
|------|--------|
| Fix | `listWhatsappLines` / `findWhatsappLineById` take a **service-role** `secretsClient`; `secretFlags` never uses the user JWT client. `/settings/lines` passes `createAdminSupabase()` for flags only. REVOKE retained. |
| Evidence | `whatsapp-lines.ts`; `settings/lines/page.tsx`; test `whatsapp-lines.test.ts` — “loads presence flags via secrets client; never selects secrets with user JWT client” |

## 9.2 Blocker — cross-org decrypt IDOR

| Item | Detail |
|------|--------|
| Fix | `loadDecryptedLineCredentials(admin, lineId, orgId)` filters `eq('org_id', orgId)` before reading secrets. `upsertLineSecrets` asserts ownership. `testConnectionAction` RLS-loads the line first; composer passes `operator.orgId`. |
| Evidence | `whatsapp-lines.test.ts` — “denies decrypt when lineId belongs to another org” (no secrets table touch) |

## 9.3 Major — webhook auth before ignore

| Item | Detail |
|------|--------|
| Fix | Route authenticates instance→line→secret **before** `{ ignored: true }`. Normalize always returns `instance`. Missing/wrong secret → 401/503 even for groups. |
| Evidence | `route-auth.test.ts` — group without secret → 401; unset secret → 503; valid secret → ignored group 200 |

## 9.4 Major — encryption key fail-closed

| Item | Detail |
|------|--------|
| Fix | Ciphertext decrypt / missing key throws → mapped to **503 `SECRET_NOT_CONFIGURED`** in ingest + route (no persist). Seed TS encrypts when `CREDENTIALS_ENCRYPTION_KEY` present. |
| Legacy | `seed.sql` still inserts **plaintext** `webhook_secret` for local SQL seed without a key — documented exception. |
| Evidence | `inbound-repository.test.ts` — ciphertext key missing → 503, no messages/jobs |

## 9.5 Major — citizen race, persist-then-send, RLS

| Item | Detail |
|------|--------|
| Citizen | `upsertCitizenStub` on `citizen_phones` unique `23505` re-selects winner (same pattern as conversations). |
| Composer | Production: persist `pending` → Evolution → update `sent`/`failed` + `external_id`. |
| RLS | Migration drops authenticated INSERT/UPDATE on `messages` and `conversations`; keeps org SELECT. Composer already uses service role. |
| Evidence | `send-text.test.ts` order `persist → evolution → update`; migration-sql asserts drop policies |

## 9.6 Docs honesty

| Item | Detail |
|------|--------|
| WA-05 | Marked **PARTIAL** (`[~]`) — download/storage done; rich thread media UI deferred to inbox |
| WA-11 | Marked **PARTIAL** (`[~]`) — shared `decideSend` guard done; admin send_mode chooser UI deferred |

## Optional Minors (done)

- **Media folder:** `download-media` uses `whatsapp-media/` unless pet `sessionId` present.
- **ACK monotonicity:** `applyDeliveryAck` only upgrades rank (late `sent` cannot overwrite `delivered`/`read`).

## Remaining gaps (director)

1. Task **9.7** — refresh acceptance-matrix + re-run adversarial until PASS / PASS WITH GAPS.
2. Live Docker/Podman proofs for 6.3/6.4 still **BLOCKED** (NO_DOCKER) — unit surrogates only.
3. WA-08 media outbound still unchecked; WA-05/WA-11 UI remains follow-up.
4. Pre-existing: persist-then-crash before `enqueueJob` can skip bot drive on duplicate webhook (Minor, not fixed).
5. Product question: shared Mesa line still enqueues `process_inbound` (pet) for every non-fromMe inbound.
