# Acceptance Matrix (independent verification)

Copy scenarios **literally** from `openspec/changes/<change>/specs/**/spec.md` or delta specs. Do not paraphrase.

**Change:** `<change-name>`
**Date:** YYYY-MM-DD
**Author:** adversarial reviewer (NOT the apply session)

## Scenarios

### Scenario: <name from spec>

- **WHEN** <exact condition from spec>
- **THEN** <exact expected outcome from spec>

**Evidence (required):**
- Tool used: curl | browser MCP | DB read-only | manual
- Command / steps:
- Result: PASS | FAIL
- Notes:

---

### Scenario: <next>

...

## Summary

| Total | Pass | Fail | Blocked |
|---|---|---|---|
| N | | | |

**Verdict:** PASS (all pass) | FAIL (list blockers) | BLOCKED (missing env)

**Rule:** This matrix must be executed by a reviewer who did **not** run `/opsx:apply` for this change. Do not use only `npm test` from the implementer's suite as sole evidence.
