# Adversarial re-audit #3 — inspectoria-pet-registry-bot

**Date:** 2026-10-12  
**Reviewer role:** Independent (did not implement original change, fix loops, or round-2/3 patches)  
**Trigger:** Re-audit after session processing lease + finalize lock-order fix (`afb59b8`)  
**Scope:** OpenSpec change `inspectoria-pet-registry-bot` + branch `cursor/inspectoria-pet-registry-bot-4cd2`  
**Prior FAIL:** `reports/adversarial-review-reaudit-2.md`  
**Sources:**
- Migration `supabase/migrations/20261012040000_session_processing_lease.sql`
- Prior migrations `20261012030000_finalize_registration_completion.sql` (upsert still authoritative)
- Code: `worker/src/infrastructure/supabase-store.ts`, `store.ts`, `memory-store.ts`, `worker/src/jobs/process-inbound.ts`, `consumer.ts`
- Design D4; `tasks.md` §15–16; `acceptance-matrix.md`
- Tests: `adversarial-fixes.test.ts`, `state-machine.test.ts` (**16 passed** locally)
- Live Postgres / `supabase test db`: still unavailable in this environment

**Mindset:** refute “lease + advisory-first finalize closes re-audit #2 Majors” against PostgREST commit boundaries, cold-start holes, TTL vs job retries, and missing live SQL proof. Do not credit memory-mutex Vitest as proof of Supabase lease serialization.

---

## Spec and task alignment (re-audit #3)

| Prior re-audit #2 finding | Fix claim (`afb59b8`) | Re-audit #3 result |
|---|---|---|
| Finalize vs upsert AB-BA deadlock (Major) | Finalize reordered: advisory → row `FOR UPDATE` | **Closed** (see §1) |
| Supabase `runWithSessionLock` no-op / unlocked RMW (Major) | `claim_session_processing` / `release_session_processing` lease around `fn()` | **Closed for existing sessions** (see §2); cold-start residual Minor |
| Live SQL/pgTAP (GAP) | Still open; pgTAP unchanged for new RPCs | **GAP** (Major→GAP per env policy) |
| Store comment / tasks §15 stale (Minor) | `store.ts` comment updated for lease | **Partially closed**; tasks §15.3 / §16 still omit lease |

Design D4 now documents lease + advisory-then-row finalize + `SESSION_BUSY` retry. Tasks §16.1–16.4 still describe round-2 only; no §17 for lease (Minor docs drift).

---

## Prior Major checklist

### 1) Lock-order deadlock (upsert vs finalize) — **CLOSED**

**Evidence (`20261012040000_session_processing_lease.sql`):**
- Finalize soft-reads `line_id` / `phone_normalized` **without** row lock → `pg_advisory_xact_lock(hashtext(line||phone))` → `SELECT … FOR UPDATE` by session id.
- Upsert (`20261012030000_…`): advisory → `FOR UPDATE` on `(line_id, phone)`.
- Claim/release: same advisory → (claim) row lock order.

Soft read before advisory does **not** hold a row lock, so it does not recreate AB-BA with upsert. Concurrent upsert + finalize for the same phone serialize on the advisory key, then take the row lock in the same order.

**Residual (not reopening Major):** soft-read then lock assumes `line_id`/`phone` stable for the session id (true in this schema; no mutate path). Unproven under live concurrent SQL (GAP).

### 2) `runWithSessionLock` no-op / unlocked process_inbound RMW — **CLOSED** (existing session)

**Evidence:**
- `SupabaseWorkerStore.runWithSessionLock` no longer `return fn()`: claims lease with unique `worker:${uuid}` owner, TTL 90s; on `SESSION_BUSY` throws; `finally` releases.
- `claim_session_processing`: advisory + `FOR UPDATE`; rejects other owners while `processing_until > now()`; sets owner/until.
- `process_inbound` wraps the full critical section in `runWithSessionLock`.
- `upsert_registration_session` updates step/payload/expires only — **does not clear** lease columns (lease survives mid-handler upserts).
- Design D4 matches this model (lease columns hold exclusivity across JS; not a spanning `FOR UPDATE`).

**Composition under multi-worker / `SKIP LOCKED`:** second same-phone `process_inbound` hits `SESSION_BUSY` instead of lost-updating payload. That closes the re-audit #2 Major for the steady-state path (session already exists).

**Cold start residual (Minor, not Major):** when no session exists, claim returns `null` (no error) and the worker still runs `fn()` **without** a lease. Concurrent first messages can both create/overwrite via advisory-locked upsert and duplicate greetings. Cold start returns immediately after opener — not the photo/finish lost-update class from re-audit #2.

**Silent degrade (Minor / ops):** any claim error other than message containing `SESSION_BUSY` (e.g. RPC missing) still runs unlocked. Same class as finalize/upsert fallbacks.

---

## New / remaining findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **GAP** (was Major) | verification | **Live SQL/pgTAP and live webhook↔worker bus still unproven.** Lease + reordered finalize read correctly on paper; `pet_registry_pgtap.sql` still does not exercise `claim_session_processing`, `release_session_processing`, finalize lock order, or concurrent same-phone finish. | No `supabase test db` here; pgTAP unchanged for new RPCs; Vitest is memory-mutex only | **Tests/ops:** extend pgTAP (busy lease, expire, finalize advisory-first); run `supabase test db` / CI before archive. |
| **Minor** | job retries | **`SESSION_BUSY` burns `attempts` with fixed +5s `available_at`.** Orphaned lease after crash (TTL 90s) or sustained contention can exhaust `max_attempts` (default 5 ≈ 25s) and permanently fail the job while the lease is still valid. Design D4 implies retry succeeds; consumer has no TTL-aware delay / non-counting busy. | `consumer.ts` + `markJobFailed` + claim TTL 90 | **Code:** on `SESSION_BUSY`, defer `available_at` near lease TTL and/or do not count toward max attempts; or shorten TTL (~15–30s). |
| **Minor** | cold start | Concurrent first inbound for a phone runs unlocked until a session row exists; duplicate greetings / last-upsert-wins possible. | `claim_session_processing` returns null → store still runs `fn()` | **Code:** insert-or-claim RPC that creates a lease-holding row, or claim-after-upsert retry once. |
| **Minor** | contracts / tasks | Tasks §15.3 still describe one-shot `FOR UPDATE` lock; §16 omits lease. Acceptance matrix still says “awaiting re-audit #2”. | `tasks.md`, `acceptance-matrix.md` | **Docs:** add §17 lease tasks; refresh matrix for re-audit #3. |
| **Minor** | fallback path | Finalize/upsert/claim missing → unlocked compose paths remain. | `supabase-store.ts` | **Ops:** fail-loud in production if lease/finalize RPCs missing. |
| **Minor** | media failure UX | Unchanged: permanent `download_media` failure → endless `photos_saving`. | photo gate | **Code:** fail closed after N failures. |
| **Question** | LID | Unresolved `@lid` session key fabrication (unchanged). | `normalize-evolution.ts` | Product confirm. |

---

## What remains solid under re-attack

- Atomic finalize + completing-without-id resume (re-audit #1/#2 closures) not reopened.
- Finalize lock order now matches upsert/claim (advisory → row).
- Supabase `runWithSessionLock` is no longer a no-op for existing sessions; D4 and `store.ts` comments align with lease semantics.
- Upsert preserves lease columns; finalize clears lease only after animal+done commit (concurrent waiter then sees `completedAnimalId` short-circuit).
- Prior closed items (photo→finish gate, webhook secret, `fromMe`, `health_card`, returning geo, confirm OK-only, `citizenUpsertSchema`, no invented `externalId`) not reopened.
- Vitest: adversarial-fixes + state-machine — **16 passed** in this review environment (still not Supabase lease proof).

---

## Verdict

**PASS WITH GAPS**

Archive is **conditionally advisable** after human OK on the environment GAPs — not blocked on the two Majors from re-audit #2.

Those Majors are **closed with code/migration/design evidence**:
1. Finalize advisory→row lock order matches upsert (deadlock class removed on paper).
2. Session processing lease makes Supabase `runWithSessionLock` real exclusivity across the JS critical section for existing sessions.

Remaining risk is **verification GAP** (live SQL / pgTAP / concurrent lease proof) plus Minors (SESSION_BUSY vs TTL attempts, cold-start unlocked window, stale tasks, fallbacks, media UX). Per project guidance, unproven live SQL stays **GAP**, not Major.

---

## Recommended next steps (before archive)

1. Extend pgTAP for claim busy/expire, release ownership, finalize advisory-first coexistence with upsert; run `supabase test db` when CLI is available.
2. Align `SESSION_BUSY` retry policy with lease TTL (defer or non-counting busy).
3. Optionally close cold-start lease hole (create-or-claim).
4. Refresh tasks §15.3 / add §17 lease; update acceptance-matrix verdict line for re-audit #3.
5. Human archive OK once GAP tolerance is accepted (writer ≠ this reviewer).
