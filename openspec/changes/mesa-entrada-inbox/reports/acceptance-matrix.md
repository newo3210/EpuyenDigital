# Acceptance Matrix — mesa-entrada-inbox

Scenarios from `openspec/changes/mesa-entrada-inbox/specs/**`.  
**Date:** 2026-11-06 (America/Buenos_Aires)  
**Author:** Project Director (not apply agent; apply by [Apply mesa-entrada-inbox](bc-0e6010c0-cd91-5a56-a385-6e630c1a6c82))

## Evidence legend

- **U** = unit/static (Vitest / SQL contract)
- **C** = code review
- **L** = live DB/RPC/E2E (BLOCKED — NO_DOCKER)

| Spec | Scenario | Result | Evidence |
|---|---|---|---|
| triage-queue | Two unowned conversations order | PASS (U) / BLOCKED (L) | `queue-sort.test.ts` |
| triage-queue | Card shows needs response and area | PARTIAL (C) / BLOCKED (L) | queue UI flags |
| triage-queue | Filter awaiting my acceptance | PARTIAL (C) / BLOCKED (L) | filter wiring |
| ownership | Successful claim | PASS (U/C) / BLOCKED (L) | RPC + ownership services |
| ownership | Claim conflict | PASS (U) / BLOCKED (L) | `ownership-errors.test.ts` / CLAIM_CONFLICT |
| ownership | Reply on unowned claims | PASS (U/C) / BLOCKED (L) | ensure_owner on send-text |
| ownership | Reply blocked for other owner | PASS (U/C) / BLOCKED (L) | ownership errors |
| ownership | Delegate to user | PASS (C) / BLOCKED (L) | delegate RPC + UI |
| ownership | Accept and reject user delegation | PASS (C) / BLOCKED (L) | accept/reject RPCs |
| lifecycle | Move to waiting external | PASS (C) / BLOCKED (L) | move RPC |
| lifecycle | Resolve conversation | PASS (C) / BLOCKED (L) | resolve RPC |
| lifecycle | Citizen message reopens resolved | PASS (C) / BLOCKED (L) | inbound reopen path |
| lifecycle | Timeline after claim and resolve | PASS (C) / BLOCKED (L) | conversation_events |
| lifecycle | Move conversation to Inspectoría area | PASS (C) / BLOCKED (L) | set_conversation_area |
| realtime | New inbound appears live | PARTIAL (C) / BLOCKED (L) | Realtime subscription code |
| realtime | Delegation badge | PARTIAL (C) / BLOCKED (L) | badge wiring |
| read-state | Open thread marks read | PASS (C) / BLOCKED (L) | mark_conversation_read |
| quick-replies | Insert quick reply into composer | PASS (C) / BLOCKED (L) | quick replies UI + seed |
| area-sla | Critical after elapsed business minutes | PASS (U) / BLOCKED (L) | `sla.test.ts` |
| inquiry-map | Location does not overwrite pet GPS | PASS (U) | `inquiry-coords.test.ts` |
| inquiry-map | Card shows map when coords present | PASS (C) / BLOCKED (L) | map component |
| org-tenancy | Operator cannot read other area | PASS (C/static RLS) / BLOCKED (L) | migration policies |
| org-tenancy | Admin reads all org areas | PASS (C/static) / BLOCKED (L) | admin bypass |
| outbound | Delivered tick visible | PASS (C) / BLOCKED (L) | thread ticks |
| outbound | Operator sends text in production | PASS (U) / BLOCKED (L) | send-text + ensure_owner |
| outbound | Empty body rejected | PASS (U) | prior + send-text |
| outbound | Reply on unowned claims then sends | PASS (U/C) / BLOCKED (L) | ensure_owner path |
| outbound | Delivered ACK stored | PASS (U) | channel ACK persistence |

## Summary

| Total | Pass unit/static/review | Fail | Live blocked |
|---|---|---|---|
| 28 | majority | 0 | nearly all live proofs |

**Gaps for adversarial:** nested ensure_owner; pet gate behavior; NO_DOCKER.

**Verdict:** **PASS WITH GAPS** / live **BLOCKED** — director re-ran `npm test` (**643** pass). Ready for adversarial.
