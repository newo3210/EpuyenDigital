# Adversarial review — mesa-entrada-inbox

**Scope:** OpenSpec change `mesa-entrada-inbox` · PR [#7](https://github.com/newo3210/EpuyenDigital/pull/7) · branch `cursor/mesa-entrada-inbox-0e30` · base `origin/main`  
**Reviewer:** independent adversarial session (did **not** implement)  
**Date:** 2026-11-07  
**Sources:** `proposal.md`, `design.md`, `tasks.md`, `specs/**`, `reports/verify-mechanical.md`, `reports/acceptance-matrix.md`, steps 4.2–4.4, `git diff origin/main...HEAD`, migration `20261107120000_mesa_entrada_inbox.sql`, inbox features/UI, `ensure_owner` on send-text, pet gate, inquiry coords

---

## Spec and task alignment

| Must be true for “done” | Assessment |
|---|---|
| SQL transitions with FOR UPDATE + CLAIM_CONFLICT | Present in migration; **no live race proof** (NO_DOCKER) |
| Area RLS via `current_area_ids()` (+ admin, delegation) | SELECT policies rewritten; inactive users gated via `current_org_id()` null |
| ensure_owner on composer send | Wired in `send-text` / outbound action |
| Dual inquiry coords; never write citizens GPS | Inbound denorms `conversations.inquiry_*` only; citizen update path omits lat/lng |
| SLA business hours (INB-15) | Status helpers exist; **due clock and tests diverge from business hours** |
| Realtime queue/badge (INB-09/14) | Code + publication; **live E2E blocked**; filter/leak risks |
| Pet coexistence | Gate **shipped** despite design/proposal “product default: keep enqueue until explicit gate” |
| INB-01..15 checkboxes | Marked `[x]` while live proofs BLOCKED — overclaim vs acceptance matrix honesty |

**Non-goals respected:** no LLM routing, no full POB CRUD, no WA media outbound composer.

**Underspecified / drifted:** nested `ensure_owner` → claim (flagged by implementer); pet gate product rule vs chicken-and-egg; area-delegation UI vs “claim-as-accept”; realtime authorization assumptions.

---

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Blocker** | pet gate / INSP-PET | **Pet `process_inbound` gate creates a chicken-and-egg on the shared line.** Seed line `Inspectoría` uses `default_area_id = Mesa`. Gate enqueues pet only if area name contains `"inspector"` **or** an open `registration_sessions` row exists. Sessions are **created inside** `worker` `process_inbound` when missing. Mesa inbound without a session never enqueues → session never created → **Inspectoría registration cannot start** on the only phone line. Contradicts design D4 / proposal product default (“keep pet enqueue until explicit gate”) and regresses prior channel-core behavior. | `supabase-inbound-store.ts` `shouldEnqueuePetProcessInbound`; `inbound-repository.ts` gate; `worker/src/jobs/process-inbound.ts` creates session only after job runs; `seed.ts` Mesa default; tests assert Mesa skips enqueue | **Code:** revert gate **or** enqueue when line is the Inspectoria instance / bot enabled / keyword / explicit product rule that still allows first-message session create. **Spec:** document chosen rule; add scenario for first contact on shared Mesa-default line. **Tests:** first inbound Mesa → session start still possible if product requires it |
| **Major** | ownership / UI | **Area delegation is not operable from the thread UI.** After area delegate: `owner_user_id=null`, `awaiting_acceptance=true`. Claim button requires `!awaitingAcceptance`; accept/reject require `isPendingTarget` (`owner_user_id === me`). Both false → **no Claim, no Accept, no Reject**. Reply path can claim-as-accept via `ensure_owner`, but area_lead **cannot reject** from UI at all. Spec requires claim-as-accept + area_lead reject. | `thread-actions.tsx` conditions; `delegate_conversation` area branch; ownership spec area scenario | **Code:** show Claim when `awaiting && pending_area_id` and caller in area; show Reject for area_lead/admin on area pending. **Tests:** UI/action matrix for area handoff |
| **Major** | ownership / authz | **Cross-area user delegation leaves the acceptor stranded.** UI offers **all org operators** as targets. After accept, `delegated_from_user_id` is cleared and `lock_conversation_for_transition` requires `conversation_area_accessible(area_id)` (or pending/delegator). Acceptor outside the conversation area can **SELECT** (RLS `owner_user_id = auth.uid()`) and open composer, but **ensure_owner / move / resolve / delegate fail AREA_FORBIDDEN**. Send maps every ensureOwner error to “owned by other”. | `lock_conversation_for_transition`; `accept_conversation_delegation` clears delegator; inbox thread loads all profiles; `send-text.ts` conflict mapping | **Code:** either restrict delegate targets to area members, **or** treat current owner as authorized in lock helper; map FORBIDDEN distinctly. **Tests:** cross-area delegate → accept → reply |
| **Major** | area-sla / INB-15 | **`refresh_conversation_sla_due` sets `sla_due_at = entered + calendar critical minutes`**, ignoring business hours/holidays, while card status uses `businessMinutesBetween`. Due timestamp and status can disagree once hours are configured. TS SLA tests only cover empty hours (calendar fallback)—no weekday/holiday edge cases. | migration `refresh_conversation_sla_due`; `sla.ts` / `sla.test.ts` | **Code:** compute due using business-minute addition (or stop exposing calendar due). **Tests:** warning/critical across lunch gap, holiday, overnight |
| **Major** | inbox-realtime / privacy | **Realtime subscriptions are org-wide and messages have no `org_id` filter.** Conversations filter is only `org_id`; messages `INSERT` is unfiltered at subscribe time. Badge increments on every matching event (including other areas the JWT/RLS may still deliver, and noisy self-updates). Correctness/privacy hinges entirely on Realtime RLS being enabled for the project—**not proven** (NO_DOCKER). Spec requires badge for inbound/delegation to **self**, not org-wide chatter. | `inbox-realtime.tsx`; publication SQL only | **Code:** filter messages by `org_id`; prefer area-scoped channels or server badge count; ignore updates that are not inbound/delegation-to-self. **Tests:** operator A must not observe B-area payloads when Realtime RLS on |
| **Major** | process / REQUIREMENTS | **INB-01..15 (and related) marked `[x]` while live RPC/E2E are BLOCKED.** Acceptance matrix correctly says PARTIAL/BLOCKED for claim races, realtime, RLS live proofs. Mechanical verify already WARN on nested ensure_owner + pet gate + NO_DOCKER. Overclaim vs “NO_DOCKER gaps” hunt item. | `.planning/REQUIREMENTS.md` INB rows; steps 4.3/4.4; acceptance-matrix | **Docs:** mark INB-09/14 (and any live-only) as `[~]` until Docker proofs, or keep `[x]` only with explicit “code-complete / live pending” note matching matrix |
| **Minor** | UI | `{(isOwner \|\| true) && (` always shows set-area form to non-owners; RPC still enforces owner/admin—confusing failed actions. | `thread-actions.tsx` ~189 | **Code:** `isOwner \|\| isAdmin` (pass role) |
| **Minor** | events | Area `delegate_conversation` updates `area_id` **before** inserting DELEGATED event, so `from_area_id` equals target (audit trail wrong). | migration delegate area branch | **Code:** capture `v_from_area` before update |
| **Minor** | outbound UX | All `ensureOwner` failures surface as “owned by other”, including FORBIDDEN / RESOLVED / INVALID_STATE. | `send-text.ts` | **Code:** branch on `OwnershipError.code` |
| **Minor** | SLA TS | Holiday path advances with `setUTCDate(+1)` while normal path uses `+24h`—fragile near TZ midnight. | `sla.ts` loop | **Code:** unify day walk with zoned midnight like SQL helper |
| **Minor** | reopen | `reopen_conversation` granted to `authenticated` with only RLS visibility (any area member who can see a resolved row can reopen)—not owner-gated. Webhook/service_role path is fine. | migration reopen | **Spec or code:** restrict to service_role / system, or document operator reopen as allowed |
| **Question** | nested ensure_owner | Nested `ensure_owner_for_reply` → `claim_conversation` / `accept_*` re-`FOR UPDATE` **same transaction** is valid in PostgreSQL (no self-deadlock). Residual risk is untested concurrent losers and PostgREST error-shape mapping—not nested lock itself. | migration ensure_owner + claim; implementer WARNING | Confirm with live concurrent claim when Docker available; no code change required for nesting alone |
| **Question** | product | If product **intentionally** wants Mesa to never start pet bot unless routed to Inspectoría first, the Blocker becomes an accepted behavior—but then INSP-PET on this shared line needs an explicit start path (set-area automation, second line, or keyword). | design D4 vs shipped gate | Human product decision before archive |

---

## What held up (mitigations that matter)

- Claim/unowned path uses `lock_conversation_for_transition` + `FOR UPDATE` and raises `CLAIM_CONFLICT` with `owned_by:<uuid>` (structure sound; live race still unproven).
- Inquiry location: message + `conversations.inquiry_*` denorm; citizen update explicitly avoids lat/lng — **inquiry-map dual-coords requirement looks met in code**.
- Authenticated INSERT/UPDATE on conversations/messages remain dropped (service-role writes)—reduces client IDOR writes; area SELECT policy is the read boundary.
- Inactive operators: `current_org_id()` / `current_user_role()` require `is_active`, so area SELECT `org_id = current_org_id()` fails closed.

---

## Verdict

**FAIL**

At least one **Blocker** (pet gate registration deadlock on shared Mesa-default line) and multiple **Majors** (area-delegation UI, cross-area ownership lock gap, SLA due vs business hours, realtime filter/privacy, REQUIREMENTS overclaim) remain.

**Archiving is not advisable** until the Blocker is fixed or an explicit product waiver is recorded in OpenSpec, and Majors are fixed or downgraded with evidence.

---

## Recommended next steps (before archive)

1. Fix or waive pet gate with a first-contact path that preserves Inspectoría registration on the shared line; add scenario + test.
2. Fix area-delegation Claim / Reject UI (and optionally filter “awaiting my area”).
3. Fix lock authz vs delegate target rules (same-area targets **or** owner bypass in lock).
4. Align `sla_due_at` with business minutes; extend SLA tests beyond empty hours.
5. Tighten realtime filters / badge semantics; document Realtime RLS dependency.
6. Soften INB checkbox claims to match NO_DOCKER reality.
7. Re-run adversarial on the fix PR; then human OK → archive.
