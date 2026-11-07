# Adversarial re-audit — mesa-entrada-inbox (after §7 fix round 1)

**Scope:** OpenSpec change `mesa-entrada-inbox` · branch `cursor/mesa-entrada-inbox-0e30` · base `origin/main`  
**Reviewer:** independent adversarial session (did **not** implement apply or §7 fixes)  
**Date:** 2026-11-07  
**Prior verdict:** `reports/adversarial-review.md` **FAIL**  
**Fixes claimed:** `reports/adversarial-fixes-round1.md` · tasks §7.1–7.6  
**Focus commits:** `8c15ec7`, `4d87dbb`, `5e9192a`, `f00f719`, `835eaf2` (+ matrix refresh `19bcb3b`)  
**Sources:** prior FAIL, fixes report, refreshed `acceptance-matrix.md`, `proposal.md` / `design.md` / `tasks.md` / `specs/**`, migration `20261107120000_mesa_entrada_inbox.sql`, inbox UI/realtime/outbound/inbound/SLA code + focused Vitest (42 pass)

---

## Spec and task alignment

| Must be true | Re-audit |
|---|---|
| Pet first-contact on shared Inspectoria instance (Blocker §7.1) | **Fixed** — instance/line/area/session gate; seed `evolution_instance=inspectoria` + Mesa default area enqueues |
| Area Claim / Reject UI (§7.2) | **Fixed** — Claim on area handoff when caller in pending area (admin included); Reject for admin / area_lead / pending lead |
| Same-area picker + owner lock + OwnershipError map (§7.3) | **Fixed** — picker filtered by `area_members` of conversation area; lock authorizes current owner; send-text branches codes |
| Business-minute `sla_due_at` (§7.4) | **Fixed** — SQL `add_business_minutes` + refresh; TS `addBusinessMinutes` + lunch/holiday/overnight tests |
| Realtime org filter + self badge (§7.5) | **Fixed in code** — `org_id` filter on conversations + messages; badge inbound / delegation-to-self; Realtime RLS still ops/`[~]` |
| INB-09/14 honesty + minors (§7.6) | **Fixed** — REQUIREMENTS `[~]`; set-area `isOwner\|\|isAdmin`; `v_from_area` before area update |

**Non-goals still respected.** Live claim-race / Realtime RLS / browser E2E remain **NO_DOCKER** (honest in matrix).

---

## Prior findings — disposition

| # | Prior severity | Area | Status | Evidence |
|---|---|---|---|---|
| 1 | **Blocker** | Pet gate chicken-and-egg | **FIXED** | `decideShouldEnqueuePetProcessInbound`: open session **or** instance/line/area name contains `inspector`. Seeded shared line `inspectoria` + Mesa `default_area` → ingest enqueues `process_inbound` (`inbound-repository.test.ts`). Mesa-only instance without session skips. |
| 2 | **Major** | Area Claim/Reject UI dead | **FIXED** | `thread-actions.tsx` `showClaim` / `showAreaReject`; page loads `area_members`; `callerInPendingArea` includes admin; RPC `claim_conversation` still claim-as-accept for area pending. |
| 3 | **Major** | Cross-area delegate stranding | **FIXED** | Thread page filters operators to conversation `area_id` members; `lock_conversation_for_transition` short-circuits on `owner_user_id = auth.uid()`; `sendOperatorText` maps `FORBIDDEN` / `INVALID_STATE` distinctly (`send-text.test.ts`). |
| 4 | **Major** | Calendar `sla_due_at` vs business status | **FIXED** | Migration `add_business_minutes` + `refresh_conversation_sla_due`; contract test; `sla.test.ts` lunch / holiday / overnight / `addBusinessMinutes`. |
| 5 | **Major** | Realtime unfiltered + noisy badge | **FIXED (code)** | Messages subscribe `org_id=eq.{orgId}`; badge only inbound INSERT or conversation update with delegation targeting self (user pending or `pending_area_id` ∈ caller areas). Residual: project must enable Realtime RLS (documented; INB-09/14 `[~]`). |
| 6 | **Major** | INB checkbox overclaim | **FIXED** | `.planning/REQUIREMENTS.md` INB-09/14 → `[~]` with live/NO_DOCKER note. |
| — | Minor | set-area `\|\| true` | **FIXED** | `showSetArea = (isOwner \|\| isAdmin) && !awaiting` |
| — | Minor | DELEGATED `from_area_id` | **FIXED** | `v_from_area := v_row.area_id` before area update |
| — | Minor | OwnershipError UX | **FIXED** | Branched messages + es-AR copy |
| — | Minor | SLA holiday day-walk | **FIXED** | TS `nextLocalMidnight`; SQL remains source of truth for due |
| — | Minor / Question | `reopen_conversation` authenticated | **OPEN** | Still granted to `authenticated` with RLS visibility only — unchanged; not raised to Major |
| — | Question | Nested `ensure_owner` locks | **OPEN** | Still unproven live; PostgreSQL same-tx re-lock OK; not a code defect |

---

## New findings (fix-introduced / residual)

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Minor** | ownership / UI vs lock | Org-role `area_lead` **without** membership in `pending_area_id` sees **Reject**, but `lock_conversation_for_transition` does not authorize bare `area_lead` role → `AREA_FORBIDDEN`. Admin and members of the pending area (incl. `is_lead`) work. | `conversation-thread.tsx` `isAreaLead = role === 'area_lead' \|\| isLeadOfPending`; lock helper only admin/owner/area/pending/delegator | **Code:** hide Reject unless admin / pending-area member lead, **or** allow `area_lead` role in lock for area-reject path. **Tests:** matrix for role-only lead |
| **Minor** | ownership / area reject | Area reject restores `owner_user_id` to delegator but does **not** restore prior `area_id` (stays on target). Owner lock bypass (§7.3) keeps transitions usable; UX may strand conversation in target area until set-area. | `reject_conversation_delegation` update; area delegate sets `area_id = p_target_area_id` | **Spec or code:** restore `from_area` on reject, or document “stays in target area” |
| **Minor** | tests | No unit/UI matrix test for `showClaim` / `showAreaReject` props; coverage is wiring + RPC static only. | Diff `5e9192a` | **Tests:** pure helper or component cases for area handoff |
| **Minor** | pet gate | Substring `inspector` on instance/line/area is brittle (false positive/negative on rename). Seeded name works. | `decideShouldEnqueuePetProcessInbound` | **Follow-up:** explicit line flag / bot-enabled column when product stabilizes |
| **Question / ops** | realtime | Client filters ≠ authorization. Without Supabase Realtime authorization/RLS on `conversations`/`messages`, other-area payloads may still reach the browser (badge ignores most; refresh still runs). | `inbox-realtime.tsx` comment; fixes report | Verify Realtime RLS in project dashboard before archive; keep INB-09/14 `[~]` until then |

No new **Blocker** or **Major** found in the fix commits.

---

## Verification run (this session)

```text
vitest: inbound-repository, sla, send-text, migration-sql — 4 files, 42 tests passed
```

Live Docker / Realtime RLS / concurrent claim: **not available** — unchanged NO_DOCKER posture.

---

## Verdict

**PASS WITH GAPS**

Prior Blocker and Majors are addressed with code + unit/static evidence. Remaining items are **Minors**, documented ops/`[~]` gaps, and NO_DOCKER live proofs — none rise to Blocker/Major.

**Archiving:** advisable only after **human OK**, with eyes open that INB-09/14 and live race/E2E stay partial until Docker/Realtime RLS proofs. Minors may follow in a later change.

---

## Recommended next steps (before archive)

1. Human OK on product: instance-name pet gate + Mesa-only skip is the accepted coexistence rule.
2. Confirm Supabase Realtime authorization enabled for inbox tables (or accept `[~]` and track ops ticket).
3. Optional polish: area_lead Reject visibility vs lock; area_id restore on reject; UI matrix tests.
4. Mark tasks §7.7 done; proceed archive when director records human OK.
