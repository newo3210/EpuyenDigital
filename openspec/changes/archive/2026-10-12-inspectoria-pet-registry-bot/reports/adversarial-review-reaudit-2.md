# Adversarial re-audit #2 — inspectoria-pet-registry-bot

**Date:** 2026-10-12  
**Reviewer role:** Independent (did not implement original change, fix loop, or round-2)  
**Trigger:** Re-audit after `reports/adversarial-fixes-round2-2026-10-12.md` / commit `e33c1d1`  
**Scope:** OpenSpec change `inspectoria-pet-registry-bot` + branch `cursor/inspectoria-pet-registry-bot-4cd2`  
**Prior FAIL:** `reports/adversarial-review-reaudit.md`  
**Sources:**
- Round-2 fix record + `tasks.md` §16 + design D4
- Migration `supabase/migrations/20261012030000_finalize_registration_completion.sql`
- Code: `worker/src/infrastructure/supabase-store.ts`, `memory-store.ts`, `worker/src/jobs/process-inbound.ts`, `packages/shared/src/registration/state-machine.ts`
- Tests: `adversarial-fixes.test.ts`, `state-machine.test.ts` (16 passed locally)
- Live Postgres / `supabase test db`: still unavailable in this environment

**Mindset:** refute round-2 “Fixed” claims against PostgREST transaction boundaries and multi-worker composition; do not credit memory-mutex Vitest as proof of Supabase serialization.

---

## Spec and task alignment (re-audit #2)

| Prior re-audit finding | Round-2 claim | Re-audit #2 result |
|---|---|---|
| Non-idempotent / crash strand on `completing` (Blocker) | Fixed via `finalize_registration_completion` + resume | **Closed** (see §1) |
| Supabase session lock no-op across JS (Blocker) | Fixed via advisory upsert + finalize TX; D4 rewritten | **Closed for stated D4 scope** (see §2–§4); residual unlocked RMW remains Major |
| Design D4 dishonest `FOR UPDATE` across JS | D4 documents PostgREST reality | **Closed** |
| Live SQL/pgTAP (Major) | Still open | **GAP** (env-blocked; migrations correct on paper; pgTAP does not yet cover new RPCs) |

Tasks §16.1–16.4 match the code for finalize / upsert / resume. Tasks §15.2–15.3 still describe the older multi-RPC story (stale wording — Minor).

---

## Blocker checklist (requested)

### 1) `finalize_registration_completion` single TX — **CLOSED**

**Evidence:**
- Migration defines one PL/pgSQL function that: `SELECT … FOR UPDATE` on the session → idempotency check on `payload.completedAnimalId` → `complete_animal_registration` → photo inserts → `UPDATE` session to `done` with completed ids — all before return.
- Worker happy path calls `ctx.store.finalizeRegistrationCompletion` (not separate complete + mark).
- Concurrent second finalize sees `completedAnimalId` and returns `already_done := true` without a second animal insert (on paper / same TX semantics).

**Residual (not reopening this blocker):** JS still upserts `step = completing` and upserts the citizen *before* finalize. That is acceptable because resume exists and animal+mark are atomic inside finalize. Fallback in `supabase-store.ts` when the RPC is missing reverts to non-atomic compose — only relevant if migration not applied (Minor / ops).

### 2) `upsert_registration_session` advisory lock — **CLOSED**

**Evidence:**
- `upsert_registration_session` takes `pg_advisory_xact_lock(hashtext(line||phone))` then `FOR UPDATE` / insert-or-update in one TX.
- `SupabaseWorkerStore.upsertSession` prefers this RPC.
- Cold-start insert path is covered inside the same locked function (empty `FOR UPDATE` alone would not serialize creates; advisory does).

### 3) Completing-without-id resume — **CLOSED**

**Evidence:**
- `state-machine.ts` `case "completing"`: if `!payload.completedAnimalId` → `completeRegistration = true` (not terminal `already_done`).
- Unit: `state-machine.test.ts` “resumes completing without animal id”.
- Integration-style: `adversarial-fixes.test.ts` “resumes stranded completing session without animal id” (memory store) — stranded session + inbound → one animal, step `done`.

### 4) Design D4 updated honestly for PostgREST — **CLOSED**

**Evidence:** `design.md` D4 explicitly states a JS `FOR UPDATE` RPC cannot hold a lock across later JS calls, and documents upsert/finalize RPC strategy + memory mutex + crash resume. Prior false claim of spanning `SELECT … FOR UPDATE` across the worker critical section is gone.

---

## New / remaining findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Major** | SQL lock order | **`finalize_registration_completion` locks row before advisory; `upsert_registration_session` locks advisory before row (AB-BA).** Concurrent upsert + finalize for the same phone can deadlock (`deadlock_detected`). Does not recreate double-animal on paper (advisory is taken before insert), but fails jobs under overlap. | `20261012030000_finalize_registration_completion.sql`: upsert lines 25–32 vs finalize lines 88–99 | **Code:** take `pg_advisory_xact_lock` *before* `FOR UPDATE` in finalize (same order as upsert). **Tests:** pgTAP or concurrent integration when DB available. |
| **Major** | process_inbound composition | **Supabase `runWithSessionLock` is a no-op;** read→transition→upsert spans unlocked JS. Two `process_inbound` jobs for one phone (multi-worker / `SKIP LOCKED`) can lost-update session payload (e.g. photo pending ids overwritten by a concurrent finish). Memory per-phone mutex still falsely greens “serializes concurrent process_inbound”. Design D4 no longer promises spanning locks — residual correctness gap under concurrency. | `supabase-store.ts` `runWithSessionLock`; `process-inbound.ts` load then later `upsertSession`; `claim_next_job` SKIP LOCKED | **Code:** direct PG client holding one TX/advisory for the whole handler, or a single “apply_inbound” RPC; or queue-level per-phone exclusivity. **Tests:** cannot be satisfied by memory-mutex alone. |
| **GAP** (was Major) | verification | **Live SQL/pgTAP and live webhook↔worker bus still unproven.** Migrations for finalize/upsert look correct on paper; existing `pet_registry_pgtap.sql` does **not** exercise `finalize_registration_completion`, `upsert_registration_session`, advisory ordering, or concurrent finish. | No `supabase test db` here; pgTAP file unchanged for new RPCs | **Tests/ops:** extend pgTAP; run `supabase test db` / CI before archive. |
| **Minor** | contracts / docs | `WorkerStore.runWithSessionLock` comment still says Supabase “acquires lock_registration_session then runs fn”; implementation only runs `fn()`. Tasks §15.2–15.3 describe pre-round-2 completion. | `store.ts` comment vs `supabase-store.ts` | **Docs:** align comment + task notes with D4/§16. |
| **Minor** | fallback path | Finalize/upsert RPC error falls back to unlocked plain upsert / multi-RPC complete. Fine for migration lag; dangerous if silently used in prod. | `supabase-store.ts` fallbacks | **Ops:** ensure migration applied; prefer fail-loud over fallback in production. |
| **Minor** | media failure UX | Unchanged: permanent `download_media` failure → endless `photos_saving`. | photo gate | **Code:** fail closed after N failures. |
| **Question** | LID | Unresolved `@lid` session key fabrication (unchanged). | `normalize-evolution.ts` | Product confirm. |

---

## What remains solid under re-attack

- Atomic finalize path closes the prior double-animal / mark split and the completing strand (with resume).
- Advisory-locked session upsert closes cold-start and per-write lost updates *within a single upsert RPC*.
- Design D4 matches PostgREST constraints (honesty restored).
- Prior closed majors from re-audit #1 (photo→finish gate, webhook secret, `fromMe`, `health_card`, returning geo, confirm OK-only, `citizenUpsertSchema`, no invented `externalId`) not reopened by round-2.
- Vitest: adversarial-fixes + state-machine — **16 passed** in this review environment.

---

## Verdict

**FAIL**

Archive is **not advisable** yet.

The four requested prior blockers are **closed** with evidence in migration + worker + state machine + design D4. That is real progress over re-audit #1.

Failure is driven by **two Majors** found against the round-2 design itself:

1. Advisory vs row **lock ordering deadlock** between upsert and finalize.
2. **Unlocked multi-RPC read-modify-write** for `process_inbound` on Supabase (memory mutex does not apply), allowing session payload lost updates under concurrent same-phone jobs.

Live SQL/pgTAP remains an environment **GAP** (not a Blocker): migrations read as correct for finalize/upsert idempotency; they are still unexecuted here, and pgTAP does not cover the new RPCs.

---

## Recommended next steps (before archive)

1. Reorder locks in `finalize_registration_completion`: advisory → `FOR UPDATE` (match upsert).
2. Address same-phone `process_inbound` exclusivity (queue key, spanning advisory via direct PG, or apply-inbound RPC) — or explicitly accept and document the lost-update residual as an MVP non-goal with monitoring.
3. Extend pgTAP for finalize idempotency + upsert/finalize lock order; run `supabase test db` when CLI is available.
4. Refresh stale `store.ts` / tasks §15 wording; re-run independent adversarial review (writer ≠ reviewer).
