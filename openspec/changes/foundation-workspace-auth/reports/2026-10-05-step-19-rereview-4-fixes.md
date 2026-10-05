# Step 19 - Fourth re-review fixes: verification report

- **Change:** `foundation-workspace-auth`
- **Branch:** `feature/foundation-workspace-auth`
- **Date:** 2026-10-05
- **Source findings:** `reports/2026-10-05-adversarial-rereview-4.md` (FAIL: T-1, T-3 Major; T-2, T-4, T-5, T-6 minor; T-7, T-8, T-9 nit)
- **Design:** `design.md` D14 (contract), D15 (fourth re-review fixes)
- **User decision:** fix T-1 and T-3, the cheap minors T-2, T-4, T-5, T-6 and the docs nit T-8; name T-7 and T-9 as out of contract in the specs
- **Review range for the next adversarial pass:** `0a77033..HEAD`

## Commits

| Commit | Task | Summary |
|---|---|---|
| `c0a7674` | 19.1 | D15, error-tracking and org-tenancy specs, section-19 tasks before code |
| `894be79` | 19.2–19.6 | T-1 DNI lookahead for 3-digit-area phones; T-2 3-digit last group; T-3 authorization/cookie/single-quoted keys; T-4 strict skip rule; T-5 UUID without hex lookarounds; T-6 raw code-point length and pgTAP cases |
| `b4a56c5` | 19.7 | T-8: `ARCHITECTURE_SDD.md`, `.planning/STATE.md`, `STUDENT_DECISION_LOG.md` (D15 lesson), pgTAP comment wording |

## Finding status

| ID | Status | Evidence |
|---|---|---|
| T-1 | Fixed (in contract) | `DNI_RE` does not take a run followed by a 4-digit group after `-`/`.`, or by a final 4-digit group after a blank. Tests: `redactText - phones next to other numbers` (22 inputs with exact outputs, including `+54 9 294 445-1234`, `piso 3 294 445-1234`, `2026-10-05 294 445-1234`, `el 05/10 294 445-1234`) and the corpus contexts `piso 3 `, `2026-10-05 `, `13:06:36 `, `05/10 ` |
| T-1 edge | Out of contract (spec) | A blanks-only 3-digit-area phone directly followed by another number (`9 294 445 1234 30123456`) and a spaced DNI followed by a lone 4-digit number (`30 [phone]`) |
| T-2 | Fixed | The last phone group takes 3 or 4 digits; a candidate needs 10 or more digits. Tests: `2945 451 234`, `2945-451-234`, `tel 2945 451 234.` → `[phone]` |
| T-3 | Fixed | Secret keys now include `authorization`, `cookie`, `session`, `credential`; single-quoted keys (`util.inspect` shape); authorization/cookie lines with `:` or `=`. Tests: `redactText - secrets with quotes or after a key word` and `serialized headers and inspected objects` (`{ 'x-api-key': '[redacted]', id: 7 }`) |
| T-4 | Fixed | The skip applies only after a blank and only before a strict secret key (`token`, `secret`, `password`, `api-key`). Tests: `password=monkey:Zx91`, `password=whiskey:4ever`, `password: Turkey=2024!`, `token=hockey:Abc123` → masked whole |
| T-5 | Fixed | `UUID_RE` has no lookarounds. Test: 20 000 random UUIDs × `avatar_`, `_v2`, `row`, `id`, `file….pdf`, `…abc`, `1…` unchanged |
| T-6 | Fixed | `hasRawNameLength` (2–80 code points) in shared and web schemas; pgTAP `005_hardening` +3 (plan 42): `Ana` + 40 emoji accepted, 81 × U+1D400 and `Ana` + 78 × U+200B rejected |
| T-7 | Out of contract (spec) | Unassigned default-ignorables named in `specs/org-tenancy/spec.md`; wording narrowed to "assigned default-ignorables" |
| T-8 | Fixed | `b4a56c5`; test title "Privacy first (design D13)"; D13 changelog row marked superseded by D14 |
| T-9 | Out of contract (spec) | Secret values cut at `&`, `,`, `;` or an unbalanced quote named in `specs/error-tracking/spec.md` |

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 428 passed |
| `npm run test:db` | 136 passed |
| Contract corpus | 0 leaks: tokens × 28 separated contexts, 6 DNIs × 11 glued contexts, token pairs × 3 separators |
| Performance | All 200 KB adversarial inputs < 200 ms, including "short digit groups rejected as phones" and "key words chained before a secret" |
| `GET /login` smoke (dev server) | form rendered with `method="POST"` |
| Report probe (dev server, local test operator) | `POST /api/errors/report` → 201; stored message `wa [phone], {"authorization":"[redacted]"}, { 'x-api-key': '[redacted]' }, password=[redacted]`; no sensitive fragment stored; trace id kept in the URL; probe row deleted (0 `error_logs` rows after cleanup) |

## Notes for the reviewer

- The redaction contract is the one in `specs/error-tracking/spec.md` (formats, contexts, named out-of-contract cases), executed by `redactText - redaction contract corpus`. Findings outside the listed contexts are format requests unless they are realistic leaks.
- Known pre-existing over-masking, accepted as false positives: `1048576` → `[dni]`, `expediente 2026-000123` → `[phone]`, `session: 3` → `session=[redacted]`, authorization/cookie lines masked to end of line.
- Deferred backlog unchanged: R-3, R-6, R-10, N-5, N-6, N-7, N-10, N-13 (`.planning/STATE.md`); R-7 resolved.
