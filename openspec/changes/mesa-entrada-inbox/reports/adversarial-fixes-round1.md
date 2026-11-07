# Adversarial fixes — round 1 (mesa-entrada-inbox)

**Date:** 2026-11-07  
**Branch:** `cursor/mesa-entrada-inbox-0e30`  
**Source review:** `reports/adversarial-review.md` **FAIL**  
**Scope:** tasks §7.1–7.6 (Blocker + Majors + cheap Minors)

---

## Summary

All Blockers and Majors from the adversarial FAIL are addressed in code + unit/static tests. Live Docker/Realtime RLS proofs remain **NO_DOCKER** (INB-09/14 marked `[~]`). Re-audit (§7.7) is still pending.

---

## 7.1 Blocker — pet gate chicken-and-egg

| | |
|---|---|
| **Finding** | Gate required Inspectoría *conversation area* or open session; sessions are created inside `process_inbound` → first contact on Mesa-default shared line never enqueued. |
| **Fix** | `decideShouldEnqueuePetProcessInbound`: **true** if open session **OR** `evolution_instance` / line name contains `inspector` **OR** conversation area contains `inspector`. False only for clearly Mesa-only lines without session. |
| **Evidence** | `inbound-repository.ts` helper + Memory/Supabase stores; tests: first Mesa-default inbound on `inspectoria` instance enqueues; `mesa-entrada` instance without session skips; area/session still enqueue. |
| **Mesa triage** | Pure Mesa instance still skips pet; seeded shared line keeps registration start via instance name. |

---

## 7.2 Major — area delegation UI

| | |
|---|---|
| **Finding** | After area delegate: no Claim (blocked by `awaitingAcceptance`), no Accept/Reject (`isPendingTarget` false). |
| **Fix** | Show **Claim** when `awaiting && pending_area_id && caller in that area` (or admin). Show **Reject** for admin / `area_lead` / lead of pending area. |
| **Evidence** | `thread-actions.tsx`, `conversation-thread.tsx`, thread page loads `area_members` for caller. |

---

## 7.3 Major — cross-area user delegate

| | |
|---|---|
| **Finding** | Picker listed all org operators; acceptor outside conversation area hit `AREA_FORBIDDEN` after accept cleared delegator. Send mapped all errors as “owned by other”. |
| **Fix** | (1) Delegate user picker = members of conversation `area_id` only. (2) `lock_conversation_for_transition` authorizes current `owner_user_id`. (3) `sendOperatorText` branches on `OwnershipError.code`. |
| **Evidence** | Thread page filter; migration lock clause; `send-text.ts` + tests for FORBIDDEN / INVALID_STATE. |

---

## 7.4 Major — SLA due vs business hours

| | |
|---|---|
| **Finding** | `refresh_conversation_sla_due` used calendar `entered + critical minutes`; status used business minutes. |
| **Fix** | SQL `add_business_minutes` (mirrors `business_minutes_between`); refresh uses it. TS `addBusinessMinutes` + lunch / holiday / overnight tests. |
| **Evidence** | Migration + `sla.ts` / `sla.test.ts`; migration-sql contract asserts `add_business_minutes`. |

---

## 7.5 Major — realtime filter / badge / privacy

| | |
|---|---|
| **Finding** | Messages subscription unfiltered; badge on every org chatter. |
| **Fix** | Conversations + messages filtered `org_id=eq.{orgId}`. Badge (+ sound) only for **inbound** message INSERT or conversation update with delegation targeting self (pending owner = me **or** `pending_area_id` in caller areas). Quiet refresh otherwise. |
| **Realtime RLS (ops)** | Client filters reduce noise but **do not replace** authorization. Supabase project must have **Realtime authorization / RLS** enabled for `conversations` and `messages` so JWT area policies apply to change payloads. Without it, operators may still receive other-area rows the browser then ignores for badge — verify in dashboard before archive. Documented here as residual **NO_DOCKER** gap. |
| **Evidence** | `inbox-realtime.tsx`; REQUIREMENTS INB-09/14 → `[~]`. |

---

## 7.6 Docs + minors

| Item | Fix |
|---|---|
| INB-09 / INB-14 | `[~]` until live E2E / Realtime RLS proof |
| Set-area UI | `(isOwner \|\| isAdmin) && !awaiting` (removed `\|\| true`) |
| DELEGATED `from_area_id` | Capture `v_from_area := v_row.area_id` **before** area update |
| OwnershipError mapping | Distinct messages in send-text + es-AR copy |
| ARCHITECTURE / STUDENT_DECISION_LOG | Pet gate + SLA + realtime notes updated |

---

## Tests run

```text
npm test   # see CI / local vitest summary after push
```

Focused coverage added/updated: inbound pet gate, send-text ownership codes, SLA business minutes, migration SQL contracts.

---

## Gaps for director / re-audit

1. **§7.7** acceptance-matrix refresh + adversarial re-audit not done in this loop.
2. **NO_DOCKER:** live claim race, Realtime RLS, area-handoff E2E still BLOCKED.
3. **Minor residual:** `reopen_conversation` still granted to `authenticated` with RLS-only gate (review Question — no code change).
4. Holiday day-walk in TS uses zoned midnight helper (fixed vs `setUTCDate`); SQL remains source of truth for due when DB available.
