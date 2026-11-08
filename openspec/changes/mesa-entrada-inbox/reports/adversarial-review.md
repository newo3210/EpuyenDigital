## Adversarial review

**Scope**: OpenSpec change `mesa-entrada-inbox` (independent re-audit of the prior FAIL)
**Branch**: `cursor/mesa-entrada-inbox-3654`
**Commit**: `eacc65a` (`fix(inbox): keep visibility callable and end delegator reads`)
**Reviewer**: independent adversarial re-audit (did not implement the change)
**Date**: 2026-11-08

**Sources**:
- `openspec/changes/mesa-entrada-inbox/proposal.md`, `design.md`, `tasks.md` (including task 7.4)
- Delta specs: `specs/inbox-queue`, `specs/conversation-ownership`, `specs/inbox-thread`, `specs/municipal-areas`, `specs/whatsapp-inbound`, `specs/whatsapp-outbound`
- Prior FAIL in this file, written against `72d21dc`
- `supabase/migrations/20261107120000_mesa_entrada_inbox.sql`
- `supabase/migrations/20260930000100_foundation.sql` and `supabase/migrations/20261106120000_areas_operators_admin.sql` (grants for `current_org_id`, `current_user_role`, `current_area_ids`)
- `supabase/tests/007_inbox_triage.test.sql` (still not executed)
- `apps/web/src/features/inbox/actions.ts`, `apps/web/src/features/outbound/actions.ts`, `apps/web/src/features/outbound/send-text.ts`
- `apps/web/src/infrastructure/supabase-inbound-store.ts`, `apps/web/src/features/inbox/inbox-live.tsx`

This pass did not run pgTAP. `docker`, `podman`, and `supabase` are not on this machine. The verdict is from reading the migration and the app call sites at `eacc65a`.

### Checklist from the prior FAIL

| # | Claim | Result |
|---|---|---|
| 1 | `conversation_visible_to_caller` is revoked only from `public` and `anon`, and `EXECUTE` is granted to `authenticated`. Policies still call it. No other helper used in a policy expression is revoked from `authenticated`. | **Closed.** Revoke at line 1284 names `public, anon` only. Grant at line 1285 is `to authenticated`. SELECT policies on `conversations`, `messages`, and `conversation_events`, plus the read and insert policies on `conversation_reads`, still call it (lines 1183–1229). The update policy on `conversation_reads` uses `auth.uid()` only. `quick_replies` and `org_settings` policies call `current_org_id` and `current_user_role`, which foundation revokes from `public` and `anon` and grants to `authenticated`. Nothing in this migration revokes those, or `current_area_ids`. Helpers revoked from `authenticated` (`inbox_raise`, `profile_display_name`, `inbox_lock_conversation`, `inbox_assert_operator`, `inbox_event`, `conversations_sync_sla`, `areas_refresh_conversation_sla`, `org_settings_refresh_conversation_sla`) do not appear in any policy expression. |
| 2 | Claim and resolve set `delegated_from_user_id` null. Accept already did. | **Closed.** Accept sets it null (lines 532–536). The unowned claim `UPDATE` sets it null (lines 584–590). Resolve sets it null (lines 845–852). A pending-area member who claims is routed to accept, which also clears it. |
| 3 | A visible non-member on an unowned area delegation no longer gets `FORBIDDEN` from `ensure_owner_for_reply`. That path calls `claim_conversation`, which accepts only for a pending-area member and otherwise claims. | **Closed.** After the accept branch (owner is the caller, or owner is null and `pending_area_id` is one of the caller’s areas), a null owner on a non-resolved row `return query`s `claim_conversation` (lines 632–634). `claim_conversation` accepts only when `awaiting_acceptance`, `owner_user_id` is null, and `pending_area_id` is in `current_area_ids()` (lines 574–578). Any other unowned, non-resolved, visible caller hits the claim `UPDATE`. The composer calls this RPC before persist and before Evolution. |
| — | `inbox_lock_conversation` and `inbox_event` stay revoked from `public`, `anon`, and `authenticated`. | **Holds.** Lines 1286 and 1288. The grant block at 1308–1322 does not name them, or `inbox_raise`, `profile_display_name`, or `inbox_assert_operator`. |

### Spec and task alignment

| Must be true for “done” | This pass |
|---|---|
| Authenticated clients cannot call the lock or event helpers, and cannot insert events directly | Lock and event are revoked from `public` / `anon` / `authenticated` and not granted back. Table DML on events stays revoked. |
| Operators can read a conversation the visibility rule allows | Holds. The thread’s user-scoped selects depend on policies that call `conversation_visible_to_caller`, and `authenticated` can execute that function. |
| Visible non-member claims an unowned area delegation; a pending-area member accepts | Holds in both `claim_conversation` and `ensure_owner_for_reply`. |
| Accept, claim, and resolve end the delegator’s extra read grant | All three updates set `delegated_from_user_id` null. Reject and reopen do as well. |
| Unread is per operator against the latest inbound marker | Holds in `list_inbox_queue` (lines 1105–1111). It does not require `needs_response`. |
| Null critical minutes clear `sla_due_at` when the area or the calendar changes | Holds. The area and org-settings triggers touch `conversations.updated_at`. `conversations_sync_sla` assigns null when critical minutes are null. Trigger `EXECUTE` is checked at `CREATE TRIGGER`, which is before the revoke. |
| A duplicate of a message older than `resolved_at` does not reopen | Holds in `reopen_conversation` (`m.created_at < conv.resolved_at` no-ops). `maybeReopen` passes `p_at` from the message `created_at`. Insert and reopen are still two calls (accepted minor). |

### Prior findings

| Prior finding | Status |
|---|---|
| Blocker: `conversation_visible_to_caller` revoked from `authenticated` | **Resolved.** See checklist 1. |
| Major: claim and resolve leave `delegated_from_user_id` set | **Resolved.** See checklist 2. |
| Major: `ensure_owner_for_reply` returns `FORBIDDEN` for a visible non-member on an unowned area delegation | **Resolved.** See checklist 3. |
| Blocker: `inbox_lock_conversation` and `inbox_event` executable by `authenticated` | **Still resolved.** Both stay in the revoke list. |
| Accepted minors (split reopen, pgTAP not run, timeline actor, quick-reply edit, tablet routes, `router.refresh`) | **Still open. Still minor.** They do not fail this pass. |

### Findings

No Blocker. No Major.

| Severity | Area | Finding | Evidence | Suggested fix (code / spec / tests) |
|----------|------|---------|----------|--------------------------------------|
| Minor | Reopen | The citizen message insert and `reopen_conversation` are still two PostgREST calls. A failed reopen is retried on the duplicate webhook while the row is still resolved and the message `created_at` is not before `resolved_at`, so that retry does reopen once. On that duplicate return, `persistInbound` does not call `touchConversationTimestamps`, so preview, `needs_response`, and `last_inbound_at` can stay stale after the reopen heals. | `supabase-inbound-store.ts` `persistInbound` / `maybeReopen`. Spec asks for the same transaction as the insert. | **Code** later, if a single SQL statement is wanted. Not required before archive. |
| Minor | Proof | pgTAP was not executed (`NO_DOCKER`). `007_inbox_triage.test.sql` is still `plan(13)` and does not assert helper `EXECUTE`, a non-member claim, claim/resolve clearing `delegated_from_user_id`, or newline notes. The Vitest file only checks that the grant and revoke strings exist. | `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`. This pass: `command -v docker`, `podman`, and `supabase` are empty. | **Tests** when a database is available. |
| Minor | Timeline | The event list shows time, type, and note. It does not show the actor. | `listConversationEvents` selects `actor_kind` and not a name. `thread-view.tsx` renders `createdAt`, `eventType`, and `note`. | **Code** or spec, as a follow-up. |
| Minor | Quick replies | An admin can create and deactivate. There is no edit of shortcut, title, or body. Insert does not require `area_id` to belong to the same org. The thread spec says an admin can edit. | `createQuickReplyAction`, `deactivateQuickReplyAction`. `quick_replies_admin_insert` checks org and role only. | **Code** follow-up. Deactivate-plus-create covers the operational need. |
| Minor | Layout | Tablet width is two routes, `/inbox` and `/inbox/[conversationId]`, not a combined list and thread. | `apps/web/src/app/(panel)/inbox/page.tsx` and `inbox/[conversationId]/page.tsx`. | **Code** or spec, as a follow-up. |
| Minor | Realtime | The open inbox refreshes server data on conversation or message changes and does not reload the browser. The handler ignores the payload. | `inbox-live.tsx` calls `router.refresh()` and does not read the row. | None before archive. |
| Minor | Reads | `conversation_reads` UPDATE checks `user_id = auth.uid()` and does not re-check visibility. | Policy `conversation_reads_update_own`, lines 1233–1237. | **Code** if a former member must not touch an old marker. Low impact: the queue only lists visible rows. |
| Minor | Reopen grant | `reopen_conversation` is revoked from `public` and `anon`, then granted to `service_role`, and not revoked from `authenticated`. Supabase default privileges can leave `authenticated` with `EXECUTE`. The body raises `FORBIDDEN` unless `auth.role()` is `service_role`. | Lines 927–928, 1302, 1316. | **Code** optionally: revoke from `authenticated` as well. The JWT check already blocks a normal user. |
| Minor | Calendar | `set_business_calendar` does not reject a range whose close is not after open. | Lines 1010–1028. The admin form submits whatever open/close pair was typed. | **Code** or form validation, as a follow-up. |

### Hunts that did not become findings

- **Policy execute.** Every function named in a policy in this migration is executable by `authenticated`. The eight helpers revoked from `authenticated` are used from security-definer functions or from triggers, not from policy expressions.
- **Trigger revoke versus SLA refresh.** `areas_refresh_conversation_sla` and `org_settings_refresh_conversation_sla` lose `EXECUTE` for `authenticated`. PostgreSQL checks that privilege when the trigger is created, and these triggers are created earlier in the same file. Both functions are `SECURITY DEFINER`, so the conversation update still runs as the owner. Null critical minutes set `sla_due_at` null.
- **`service_role` may still hold `EXECUTE` on the helpers** if default privileges granted it at `CREATE FUNCTION`. The revoke list does not name `service_role`. That role bypasses RLS. It does not restore `anon` or `authenticated`.
- **Delegator read while pending.** Delegate still sets `delegated_from_user_id`. Accept, the unowned claim, resolve, reject, and reopen clear it. Move and set-area do not end the pending state, so they leave the column set. That matches “the delegator can read while acceptance is pending.”
- **Reply versus claim on the same unowned area row.** A pending-area member hits accept (directly in `ensure_owner_for_reply`, and through `claim_conversation` if they press claim). A visible caller who is not in that area claims and clears `delegated_from_user_id`. A user-targeted delegation still has an owner, so a non-assignee gets `NOT_OWNER` and does not steal it.
- **Ensure-owner versus Evolution.** `sendOperatorText` returns when `ensureOwner` fails, before `persistOutbound` and `sendViaEvolution`.
- **Known clock.** Unchanged. Friday 13:00 ART + 120 business minutes is still the Monday 09:00 fixture. The null-critical path is the trigger branch above.
- **Queue order.** SQL matches design D2: unowned first by `entered_queue_at`, then owned by `last_inbound_at`, with `needs_response` and critical as later keys. The queue spec sentence can still be read as those flags outranking time inside the group. That is a spec-versus-design question, not a code defect against D2.

### Verdict

**PASS WITH GAPS**

No Blocker. No Major.

The three failures from the prior pass are fixed at `eacc65a`: visibility stays callable by `authenticated`, claim and resolve clear `delegated_from_user_id`, and a reply on an unowned area delegation goes through `claim_conversation`. `inbox_lock_conversation` and `inbox_event` stay revoked from `public`, `anon`, and `authenticated`.

The remaining items are the accepted minors above (split reopen, pgTAP not run, timeline actor, quick-reply edit, two tablet routes, `router.refresh`) plus three smaller ones that were already open: the reads update policy, the `reopen_conversation` grant width, and calendar ranges that do not check close after open. None of those change ownership, visibility, or who can execute the internal helpers.

Archiving is **advisable**. Human OK is still the archive gate in task 5.5.

### Recommended next steps (before archive)

None of these block archive.

1. When a database is available, run `supabase/tests/007_inbox_triage.test.sql` and add cases for: `authenticated` can `SELECT` a visible conversation, `authenticated` cannot execute `inbox_lock_conversation` or `inbox_event`, a non-member claim and a resolve both leave `delegated_from_user_id` null, and a reply by that non-member claims.
2. Optionally tighten the queue spec sentence so it says time outranks `needs_response` and critical, matching design D2.
3. Leave the accepted UI minors for a later change.
