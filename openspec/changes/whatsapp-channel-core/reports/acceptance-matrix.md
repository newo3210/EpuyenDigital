# Acceptance Matrix (independent verification)

Scenarios copied from `openspec/changes/whatsapp-channel-core/specs/**/spec.md`.

**Change:** `whatsapp-channel-core`  
**Date:** 2026-11-06 (America/Buenos_Aires)  
**Author:** Project Director (did **not** run apply; apply by [Apply whatsapp-channel-core](bc-d12ed544-436f-5a84-9664-af2631d4cc1e))

## whatsapp-line-admin

### Scenario: Admin creates a line with default area
- **WHEN** an admin creates a line with a valid Evolution instance and sets `default_area_id` to Mesa de Entrada
- **THEN** the line is stored and subsequent reads show that default area  
**Evidence:** code review features/whatsapp-lines + migration FK; Result: PARTIAL | BLOCKED (live)

### Scenario: Non-admin cannot create a line
- **WHEN** an `operator` attempts to create a WhatsApp line  
- **THEN** denied  
**Evidence:** `requirePageRole(['admin'])` + nav; Result: PARTIAL | BLOCKED (live RLS)

### Scenario: Secrets not echoed after save
- **WHEN** admin saves secrets then reloads  
- **THEN** no cleartext  
**Evidence:** credentials AES-GCM + form write-only pattern; Result: PASS (unit/static) | BLOCKED (live)

### Scenario: Successful connection test / Failed connection test
**Evidence:** test-connection feature present; Result: PARTIAL | BLOCKED (live Evolution)

### Scenario: Seed links line to Mesa de Entrada
**Evidence:** seed.sql / seed.ts review; Result: PASS (source) | BLOCKED (live reset)

## whatsapp-inbound

### Scenario: Missing secret rejected
**Evidence:** director-aware `webhook-secret.test.ts` + route tests; Result: PASS (unit)

### Scenario: Valid secret accepted
**Evidence:** route/inbound tests; Result: PASS (unit) | BLOCKED (live)

### Scenario: Duplicate webhook delivery
**Evidence:** inbound-repository idempotency tests; Result: PASS (unit)

### Scenario: Group message ignored
**Evidence:** normalize-evolution tests; Result: PASS (unit)

### Scenario: First message creates conversation
**Evidence:** inbound repository conversation upsert tests; Result: PASS (unit) | BLOCKED (live)

### Scenario: Image inbound
**Evidence:** enqueue media job path + worker download; Result: PARTIAL (unit) | BLOCKED (live storage)

### Scenario: Location inbound
**Evidence:** normalize stores lat/lng on message; design D5 — not citizens GPS; Result: PASS (code review/unit if covered) | BLOCKED (live)

### Scenario: pushName captured
**Evidence:** citizen stub path; Result: PARTIAL | BLOCKED (live)

### Scenario: fromMe mirrored
**Evidence:** normalize fromMe → outbound; Result: PASS (unit)

### Scenario: New phone creates unregistered citizen
**Evidence:** inbound citizen stub; Result: PARTIAL | BLOCKED (live)

## whatsapp-outbound

### Scenario: dry_run blocks Evolution
**Evidence:** send-mode + send-text tests; Result: PASS (unit)

### Scenario: allowlist blocks unknown phone
**Evidence:** send-mode unit tests; Result: PASS (unit)

### Scenario: Operator sends text in production
**Evidence:** send-text use case; Result: PASS (unit mocks) | BLOCKED (live Evolution)

### Scenario: Empty body rejected
**Evidence:** send-text validation; Result: PASS (unit)

### Scenario: Delivered ACK stored
**Evidence:** delivery-ack + inbound ACK path tests; Result: PASS (unit) | BLOCKED (live)

### Scenario: Local format normalized
**Evidence:** shared phone normalize used on send; Result: PASS (unit)

## local-dev-environment

### Scenario: dry_run local seed
**Evidence:** seed defaults dry_run + Mesa default_area; Result: PASS (source) | BLOCKED (live reset)

## Summary

| Total scenarios | Pass unit/static | Fail | Blocked live |
|---|---|---|---|
| 23 | majority unit/static | 0 | curl/E2E/db reset |

**Known scope gaps (not scenario FAIL if honestly deferred):** WA-08 multimedia outbound not in composer; send_mode admin UI absent; delivery ticks UI → inbox.

**Verdict:** **PASS WITH GAPS** / live **BLOCKED** — ready for adversarial. Director re-ran `npm test` (613 pass).
