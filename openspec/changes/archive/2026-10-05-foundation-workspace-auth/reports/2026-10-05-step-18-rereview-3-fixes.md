# Step 18 - Third re-review fixes: verification report

- **Change:** `foundation-workspace-auth`
- **Branch:** `feature/foundation-workspace-auth`
- **Date:** 2026-10-05
- **Source findings:** `reports/2026-10-05-adversarial-rereview-3.md` (FAIL: S-1, S-2 Major; S-3..S-7 minor/nit)
- **Design:** `design.md` D14
- **User decisions:** minors S-4, S-5, S-7 plus nits; redaction strategy **Option A** (explicit contract instead of the absolute "superset of `65eb994`" rule), after the threat-model discussion in `reports/2026-10-05-redaction-superset-decision-brief.md`
- **Review range for the next adversarial pass:** `844c553..HEAD`

## Commits

| Commit | Task | Summary |
|---|---|---|
| `bb56353` | 18.1 | Decision brief on the redaction superset requirement |
| `e5c3bc9` | 18.1 | D14 (partial), org-tenancy spec, section-18 tasks before code |
| `287b563` | 18.2 | S-4: profile rows never rejected on read; form counts code points; `[\p{L}\p{Nd}]` and ICU blanks |
| `64967ae` | 18.3 | S-5: migration `20261005000600_complete_invisible_name_set.sql`; same set in JS |
| `0d926d6` | 18.4 | S-7: pgTAP zero window and negative limit |
| `70d222b` | — | Root docs for S-4, S-5, S-7 |
| `9715bae` | 18.5 | Option A: D14, error-tracking spec contract and out-of-contract list, brief status |
| `328c3b7` | 18.7–18.10 | Contract corpus test; S-1 phone loop; S-2 quoted and chained secrets; S-6 UUID lookarounds; legacy oracle removed |
| `6b5809f` | 18.8 | D14 note: DNI pass before phones |
| `52ea760` | 18.11 | S-3: docs describe the corpus as the contract; superset claims removed |

## Finding status

| ID | Status | Evidence |
|---|---|---|
| S-1 | Fixed (in contract) | `maskPhones` resumes at `index + 1` on a short candidate; last group 4 digits; DNI pass first. Tests: `redactText - phones next to other numbers` (10 reviewer inputs, exact outputs) and the corpus numeric-neighbour contexts and pairs |
| S-2 (a), (b) | Fixed | Bare value `[^\s&,;]{1,4096}`; negative lookahead skips a pair whose value is a secret pair. Tests: `redactText - secrets with quotes or after a key word` (6 inputs) and corpus tokens |
| S-2 (c)–(e) | Out of contract (spec) | More than 10 blanks, key prefixes over 40 chars, malformed JWTs outside Authorization/Bearer lines |
| S-3 | Fixed | `ARCHITECTURE_SDD.md` §redaction, `STUDENT_DECISION_LOG.md` (D14 lesson, glossary), `.planning/STATE.md`, `design.md` D13 note |
| S-4 | Fixed | `contracts.test.ts` (40 emoji / 41 astral rows parse; code points; `½½`, `A\u001c`, `A\u0085` rejected), `update-name.test.ts` |
| S-5 | Fixed | pgTAP `005_hardening` +4 (plan 39); Vitest +4 |
| S-6 (a) | Fixed | 20 000 random UUIDs × `avatar_<uuid>.png`, `<uuid>_v2`, `row<uuid>` unchanged |
| S-6 (b), (c) | Accepted | Over-masking of `idempotency-key: <uuid>`; contrived phone glued by `-` to a UUID (out of contract: numbers glued by `-`) |
| S-7 | Fixed | pgTAP `006_report_rate_limit` +2 (plan 25) |

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 399 passed (39 files) |
| `npm run test:db` | 133 passed (7 files) |
| Contract corpus | 0 leaks: 33 tokens × 24 separated contexts, 6 DNIs × 11 glued contexts, 33 × 33 × 3 pairs |
| Performance | All 200 KB adversarial inputs < 200 ms, including new "short digit groups rejected as phones" and "key words chained before a secret" |
| `GET /login` smoke (dev server) | form rendered with `method="POST"` |
| Report probe (dev server, local test operator) | `POST /api/errors/report` → 201; stored message `vecino calle 123 [phone], dni [dni] [phone], password=[redacted], missing key: token=[redacted]`; no sensitive fragment stored; trace id kept in the URL; probe row deleted (0 `error_logs` rows after cleanup) |
| Realistic log lines (throwaway probe) | Dates, times, UUIDs, ports, `127.0.0.1:54321`, HTTP codes unchanged. Known pre-existing over-masking: a 7-digit size (`1048576` → `[dni]`) and `expediente 2026-000123` (`[phone]`), both as before this step |

## Notes for the reviewer

- The acceptance criterion for redaction is now the contract in `specs/error-tracking/spec.md` (formats, contexts, named out-of-contract cases) executed by `redactText - redaction contract corpus`. Findings outside the listed contexts are format requests, not spec violations, unless they are realistic secret leaks.
- Deferred backlog unchanged: R-3, R-6, R-7, R-10, N-5, N-6, N-7, N-10, N-13 (`.planning/STATE.md`).
