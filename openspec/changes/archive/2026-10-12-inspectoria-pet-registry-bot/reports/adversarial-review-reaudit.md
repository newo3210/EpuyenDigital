# Adversarial re-audit — inspectoria-pet-registry-bot

**Date:** 2026-10-12  
**Reviewer role:** Independent (did not implement the original change or the fix loop)  
**Trigger:** Re-audit after `reports/adversarial-fixes-2026-10-12.md` / tasks §15 claim blockers+majors fixed  
**Scope:** OpenSpec change `inspectoria-pet-registry-bot` + branch `cursor/inspectoria-pet-registry-bot-4cd2`  
**Prior FAIL:** `reports/adversarial-review.md`  
**Sources:**
- Prior review + fix record + `tasks.md` §15
- Specs: `specs/{inspectoria-whatsapp-channel,pet-registration-conversation,animal-registry}/spec.md`
- Design D4 / D8
- Code: `worker/src/jobs/process-inbound.ts`, `worker/src/infrastructure/{supabase,memory}-store.ts`, `apps/web/src/infrastructure/{inbound-repository,normalize-evolution,webhook-secret}.ts`, `supabase/migrations/20261012020000_lock_registration_session.sql`
- Tests: `adversarial-fixes.test.ts`, inbound-repository / route / state-machine tests
- Live run: `npm run test` → **68 passed** (16 files); no live Postgres / `supabase test db` in this environment

**Mindset:** refute “fixed” claims with production-path composition (PostgREST transactions, crash windows), not only memory-store Vitest green.

---

## Spec and task alignment (re-audit)

| Prior finding | Claimed status | Re-audit result |
|---|---|---|
| Photo→finish race (Blocker) | Fixed | **Fixed** in code + Vitest (no mid-drain) |
| Non-idempotent completion (Blocker) | Fixed | **Not fixed** under crash / true concurrency — see findings |
| Session lock D4 (Blocker) | Fixed | **Not fixed** on Supabase path — RPC lock is a no-op across JS work |
| Per-line webhook secret (Major) | Fixed | **Fixed** |
| `fromMe` drives bot (Major) | Fixed | **Fixed** |
| `health_card` kind (Major) | Fixed | **Fixed** |
| Returning geo D8 (Major) | Fixed | **Fixed** |
| confirm/update ignored (Major) | Fixed (narrowed) | **Fixed** via spec + OK-only parser |
| `citizenUpsertSchema` (Major) | Fixed | **Fixed** at both store upserts |
| Invented `externalId` (Major) | Fixed | **Fixed** + route unit test |
| Live SQL/pgTAP (Major) | Open | **Still open** (Major) |

Tasks §15 marked `[x]` overstates closure for 15.2 / 15.3 relative to design D4 and production Supabase.

---

## Prior findings — evidence check

### Blockers claimed fixed

#### 1) Photo→finish race — **CLOSED**

- **Code:** `process-inbound.ts` gates `completeRegistration` when any pending media lacks `storagePath` or `pendingReady.length < 1`; re-prompts `animal.photos_saving`; keeps step `animal_photos`.
- **Test:** `adversarial-fixes.test.ts` “photo→listo race waits for storagePath (no mid-drain)” — processes inbound without draining `download_media`, asserts zero animals, then completes after drain with ≥1 animal photo.
- **Verdict:** Prior blocker addressed for the stated timing race.

#### 2) Non-idempotent completion — **STILL OPEN (Blocker)**

What improved:
- Sequential double-`listo` after full success: `completedAnimalId` + `mark_session_completion` / memory `markSessionCompleted`; Vitest “double finish creates only one animal” passes.
- `alreadyDone` skips re-link / re-enqueue vision.

What still fails:
1. **Crash window after `step = completing`:** completion writes `completing` **before** animal insert + `markSessionCompleted`. State machine `case "completing"` only emits `registration.already_done` and never sets `completeRegistration`. A worker crash/retry after the completing upsert (and before mark) **strands** the session: citizen cannot finish; if the animal insert already ran, an orphan active animal may exist without photo links / confirmation.
2. **Animal insert is not session-gated in SQL:** `complete_animal_registration` runs in a separate RPC from `mark_session_completion`. Without a spanning lock (see §3), two concurrent finishers can both insert animals; the second mark returns `already_done` but the extra animal remains.
3. Tests cover happy sequential double-finish and memory-mutex concurrency only — **not** mid-completion crash resume.

#### 3) Session lock (design D4) — **STILL OPEN (Blocker)**

- **Design D4:** worker applies transitions inside a transaction with `SELECT … FOR UPDATE` on the session row.
- **Memory path:** `runWithSessionLock` per-phone promise chain — real mutual exclusion; concurrent Vitest passes under this fake.
- **Supabase path:** `runWithSessionLock` calls `lock_registration_session` via `supabase-js` RPC, then runs `fn()`. PostgREST/service-role RPCs commit per call; **`FOR UPDATE` is released when the RPC returns**, so `fn()` (transition, citizen upsert, complete animal, mark session) runs **unlocked**.
- Empty session: `FOR UPDATE` on zero rows locks nothing even inside a real transaction (cold-start race).
- Fallback plain `select` in `lockSession` if RPC errors further weakens the claim.

**Conclusion:** Task 15.3 / fix record “Fixed” is a false closure for the production store. Memory mutex does not prove D4.

### Majors claimed fixed — **CLOSED** (except live SQL)

| Finding | Evidence of fix |
|---|---|
| Per-line secret | `ingestInboundEvent` → `verifyWebhookSecret(line.webhookSecret)`; 503/401 tests in `inbound-repository.test.ts`; route does not replace line secret with env except memory seed |
| `fromMe` | Persist outbound; no `process_inbound` enqueue; channel spec scenario; unit test |
| `health_card` kind | `pendingMediaKinds` written on image; link uses stored kind; Vitest asserts both kinds |
| Returning geo | `hydrateCitizenGeo` + completion Vitest lat/lng on animal |
| confirm/update | Spec narrowed to OK-only; i18n warns MVP; `parseConfirmCitizenOk`; state-machine test |
| `citizenUpsertSchema` | `.parse(...)` in memory + Supabase `upsertCitizenFromPayload` |
| Invented `externalId` | Missing `key.id` → `ignored: invalid`; route test |
| Live SQL/pgTAP | **Still Major** — migrations/pgTAP shipped; `test:db` / live bus unproven (fix record admits Open) |

---

## New / remaining findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Blocker** | design D4 / supabase | **`lock_registration_session` does not hold across the critical section.** Supabase `runWithSessionLock` acquires FOR UPDATE in a one-shot RPC then runs unlocked JS. Concurrent `process_inbound` for one phone can interleave transitions and double-complete. Memory mutex falsely greens concurrency tests. | `supabase-store.ts` `runWithSessionLock`; PostgREST per-request tx; design D4 | **Code:** single SQL/RPC transaction (or advisory lock held for the whole complete path) wrapping lock + transition writes + animal insert + mark; or dedicated completion RPC. **Tests:** cannot be satisfied by memory-only mutex — need DB-level concurrency proof. |
| **Blocker** | animal-registry / idempotency | **`completing` without `completedAnimalId` cannot resume.** Marking `completing` before durable completion + state machine treating `completing` as terminal `already_done` creates a crash strand. Concurrent unlocked complete can leave orphan animals. Sequential double-finish test does not cover this. | `process-inbound.ts` upsert `completing` then `completeAnimalRegistration` then `markSessionCompleted`; `state-machine.ts` `case "completing"` | **Code:** resume completion when `step === completing` and payload incomplete; ideally one atomic RPC: insert animal iff session not completed, set `completedAnimalId`, link photos. **Tests:** crash-replay between completing upsert and mark; concurrent finish against real Postgres. |
| **Major** | verification | **SQL/pgTAP and live webhook↔worker bus still unproven.** Same as prior Major; tasks 4.x/10.x/15 still lack live DB evidence. Counter races, species CHECK, private bucket, and real `FOR UPDATE` behavior remain paper claims. | `adversarial-fixes-2026-10-12.md` Open; step-10 report; no supabase CLI here | **Tests/ops:** run `supabase test db` (or CI) before archive; add concurrency pgTAP for lock/completion RPCs. |
| **Minor** | contracts / tests | No Vitest that `citizenUpsertSchema` rejects incomplete payload at the store boundary (unit schema tests exist; store path only happy-path). | store upserts call parse; no negative store test | **Tests:** assert Zod throw on missing geo/consent at upsert. |
| **Minor** | media failure UX | Permanent `download_media` failure leaves `storagePath` null → endless `photos_saving` / cannot complete. | gate on `storagePath` | **Code:** fail closed with re-prompt / drop bad pending id after N failures. |
| **Question** | LID | Unresolved `@lid` still may fabricate session keys (unchanged). | `normalize-evolution.ts` | Product confirm. |

---

## What remains solid under re-attack

- Webhook thinness (static import test).
- Consent-before-PII in the pure state machine.
- Location gate (native only).
- Horse not offered (menus / Zod / SQL CHECK on paper).
- Send-mode guard.
- Vision failure → `pending_manual` without blocking ID issuance (unit path).
- Photo race gate + health_card kind + returning geo + fromMe + line secret + no invented externalId (code + Vitest as above).

---

## Verdict

**FAIL**

Archive is **not advisable**. Several prior majors are genuinely closed, and the photo-finish race is closed, but the two production-critical blockers (real session locking under Supabase, crash-safe / concurrent idempotent completion) remain. Tasks §15.2–15.3 and the fix record over-claim “Fixed” for those items based on memory-store evidence that does not exercise PostgREST transaction boundaries.

---

## Recommended next steps (before archive)

1. Replace fake Supabase lock with a **single transactional RPC** (or connection-held tx) that locks, completes, and marks idempotently — prove with pgTAP concurrency.
2. Make `completing` **resumable** (or do not persist `completing` until animal+mark succeed); add crash-replay Vitest + SQL test.
3. Run **live `supabase test db`** and refresh step-10 / verify artifacts.
4. Re-run independent adversarial review after those land (writer ≠ reviewer).
