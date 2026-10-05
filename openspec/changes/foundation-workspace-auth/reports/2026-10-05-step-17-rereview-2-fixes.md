# Step 17 — Second re-review fixes: verification report

- **Change:** `foundation-workspace-auth`
- **Branch:** `feature/foundation-workspace-auth`
- **Date:** 2026-10-05
- **Scope (user-approved):** Major R-1 with the **strict superset** policy (privacy over keeping IPs and decimals intact), plus cheap findings R-2, R-4, R-5, R-8 and R-9.
- **Source findings:** `reports/2026-10-05-adversarial-rereview-2.md`
- **Design:** `design.md` D13
- **Deferred to backlog:** R-3, R-6, R-7, R-10 (see `.planning/STATE.md`)

## Commits

| Commit | Task | Summary |
|---|---|---|
| `9f48c69` | 17.1 | D13 design, spec deltas and section-17 tasks written before any code |
| `6767886` | 17.2 (R-1) | `DNI_RE` keeps only digit boundaries, so DNIs next to `digit.` / `.digit` are masked. The frozen `65eb994` redaction becomes a test oracle, and a property test checks 27 tokens × 27 contexts |
| `b0a1fb9` | 17.3 (R-2) | CUIT, phone and DNI passes run only between canonical UUID tokens; emails run first, on the whole text |
| `9dc5099` | 17.4 (R-4) | Name check trims an extended invisible set and requires a letter or number once invisible characters are removed (database and form) |
| `fb2844c` | 17.5 (R-5) | `insert_client_error_report` raises `22023 invalid_argument` on a null user, a null or non-positive limit, or a null or non-positive window |
| `2806ccb` | 17.6 (R-8) | SSR test asserts that the form is wired to the bound server reference; the real `method="POST"` is checked over HTTP |

## Automated checks

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 39 files, **365 tests passed** (337 after step 16) |
| `npm run test:db` | 7 files, **127 tests passed** (111 after step 16) |
| Migrations | `20261005000400_visible_profile_names.sql` and `20261005000500_report_function_arguments.sql` applied with `migration up --local` (no reset); 6 migrations in total |

Superset evidence: before the R-1 fix, the property test listed 20 leaking cases, all DNIs next to digit-dot sequences. After the fix it lists none. The UUID property test (20 000 random UUIDs, alone and inside `/support/errors?id=<uuid>`) changed 0 of them. A 200 KB input of UUIDs between DNIs stays under the 200 ms budget.

## HTTP probes (local dev server + local Supabase)

| Probe | Expected | Observed |
|---|---|---|
| `GET /login` | form posts to the server action | `<form ... action="" encType="multipart/form-data" method="POST">` with hidden `$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_KEY` |
| 50 concurrent authenticated reports | at most 10 stored | 10 × `201`, 40 × `429`; 10 rows stored; the trace UUID inside the stored message is intact |
| REST self-update `full_name = 'ㅤㅤ'` (U+3164 × 2) as the operator | rejected | `23514` (check violation) |

Requests used real `@supabase/ssr` cookies from a password sign-in with the local e2e operator. Probe rows were removed.

## Final DB state

- `profiles`: 1 admin (seed) + 1 operator (`e2e.operator@epuyen.local`, local-only test user), both active; operator name unchanged (the blank-name update was rejected).
- `error_logs`: 0 rows.
- Temporary probe script deleted; dev server stopped.

## Remaining before archive

- 17.8 documentation (R-9) and backlog (R-3, R-6, R-7, R-10).
- New adversarial re-review in a separate session, scoped to `4cb9efa..HEAD`.
- `acceptance-matrix.md`, then human OK, then `/opsx:archive`.
