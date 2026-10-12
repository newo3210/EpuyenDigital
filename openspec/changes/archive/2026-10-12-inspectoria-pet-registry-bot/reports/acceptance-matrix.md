# Acceptance Matrix (independent verification)

**Change:** `inspectoria-pet-registry-bot`  
**Date:** 2026-10-12  
**Author:** director session (evidence from curl reports + Vitest; not sole implementer unit suite)

Scenarios copied from OpenSpec specs. Evidence mixes curl (webhook) and worker Vitest (conversation), because live Evolution/Supabase bus is unavailable in this Cloud Agent environment.

## Channel

### Scenario: Missing or wrong secret rejected
- **WHEN** the webhook secret is missing or does not match  
- **THEN** the handler returns HTTP 401 and does not persist the message  
**Evidence:** curl step-11 — PASS (`401 UNAUTHORIZED`)

### Scenario: Duplicate delivery
- **WHEN** the same Evolution message id is delivered twice  
- **THEN** only one message row exists and the second call still returns 200  
**Evidence:** curl step-11 — PASS (`duplicate: true`)

### Scenario: Group ignored
- **WHEN** the payload is from a WhatsApp group  
- **THEN** the system returns 200 and creates no citizen or registration session  
**Evidence:** curl step-11 — PASS (`ignored: true, reason: group`)

### Scenario: Dry run
- **WHEN** send mode is `dry_run`  
- **THEN** the outbound text is persisted as blocked/simulated and Evolution is not called  
**Evidence:** worker `send-mode.test.ts` / handlers — PASS

## Conversation

### Scenario: Accept consent
- **WHEN** a new session starts and the citizen replies accepting the notice  
- **THEN** the session moves to citizen data collection and `privacy_consent_at` is set  
**Evidence:** `flow.test.ts` / state-machine — PASS

### Scenario: Known phone
- **WHEN** a registered citizen messages the line  
- **THEN** the bot greets them using their stored full name  
**Evidence:** flow returning path + geo copy test — PASS

### Scenario: Location shared / Non-location while waiting
- **WHEN** location pin vs text at location step  
- **THEN** advances vs re-prompt  
**Evidence:** state-machine tests — PASS

### Scenario: Finish without photos blocked / First photo accepted
**Evidence:** state-machine + adversarial photo race test — PASS

### Scenario: Completion confirmation with municipal ID
**Evidence:** flow.test.ts + E2E fixture report — PASS

## Animal registry

### Scenario: Animal linked / Multiple animals / ID uniqueness
**Evidence:** worker Vitest (memory store) — PASS; live SQL — BLOCKED (no Supabase CLI)

### Scenario: Vision failure → pending_manual
**Evidence:** vision-client.test.ts — PASS

### Scenario: Private bucket / redacted logs
**Evidence:** migration declares private bucket; redact helper used in consumer — PARTIAL (live bucket ACL unproven)

## Summary

| Total | Pass | Fail | Blocked |
|---|---|---|---|
| 14 | 12 | 0 | 2 (live SQL / storage ACL) |

**Verdict:** PASS WITH GAPS (environment) — awaiting adversarial re-audit #2 verdict and human archive OK.
