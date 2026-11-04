# Step 16 — Adversarial re-review fixes: verification report

- **Change:** `foundation-workspace-auth`
- **Branch:** `feature/foundation-workspace-auth`
- **Date:** 2026-10-05
- **Scope (user-approved):** blocker N-1, majors N-2, N-3, N-4, plus cheap findings N-8, N-9, N-11, N-12 and N-14. The rate limit is enforced atomically in SQL (`sql_atomic`). Redaction must be a superset of what `65eb994` masked (`superset`).
- **Source findings:** `reports/2026-10-05-adversarial-rereview.md`
- **Design:** `design.md` D12
- **Deferred to backlog:** N-5, N-6, N-7, N-10, N-13 (see `.planning/STATE.md`)

## Commits

| Commit | Task | Summary |
|---|---|---|
| `7ef0b66` | 16.1 | D12 design, spec deltas and section-16 tasks written before any code |
| `ab3b164` | 16.2 (N-3, N-4) | Quoted secret values (single, double, escaped JSON) and DNIs glued to `_`, `.` or letters masked again; still linear time |
| `2b52b43` | 16.3 (N-1, N-2) | `error_logs.origin` column (`server` / `client`) and `insert_client_error_report` function: advisory lock per user, count and insert in one transaction |
| `3322e8e` | 16.4 (N-1, N-2) | Report endpoint stores through the atomic function; the pre-body count stays as a cheap advisory 429 |
| `71e2246` | 16.5 (N-8) | Filter dates outside years 2000–2100 are dropped |
| `50e1dde` | 16.6 (N-9, N-11) | `MAINTAIN` revoked from `authenticated`; profile names made only of Unicode blanks (tab, NBSP, zero-width, BOM) rejected |
| `2828b1b` | 16.7 (N-12) | Server-rendered login form asserted to carry `method="POST"` and the action id field |

## Automated checks

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 39 files, **337 tests passed** (306 after step 15) |
| `npm run test:db` | 7 files, **111 tests passed** (89 after step 15) |
| Migrations | Applied with `migration up --local` (no reset); 4 migrations in total |

The redaction superset was checked by running the new regression cases against the `65eb994` implementation: every case it masked is still masked. The worst performance input stays under 18 ms for a 16 KB string.

## HTTP probes (local dev server + local Supabase)

Requests used real `@supabase/ssr` cookies from a password sign-in with the local e2e operator. Each request sent a fresh UUID as both the `x-trace-id` header and `body.traceId`. The probe ran twice (cold and warm server) with identical results.

| Probe | Expected | Observed |
|---|---|---|
| 50 concurrent small reports | at most 10 stored | 10 × `201`, 40 × `429`; **10 rows** stored |
| 11 sequential maximum-size reports (~11 KB body, details over 8192 chars) | 11th rejected | 10 × `201`, then `429`; 10 rows stored, all with `details.truncated = true` |

The first probe proves the race in N-2 is closed: the sequential pgTAP test cannot show this. The second proves N-1: truncated details no longer escape the count, because the limit is keyed on the `origin` column instead of `details->>'origin'`.

## Final DB state

- `profiles`: 1 admin (seed) + 1 operator (`e2e.operator@epuyen.local`, local-only test user), both active.
- `error_logs`: 0 rows (probe rows removed).
- Temporary probe script deleted; dev server stopped.

## Remaining before archive

- 16.9 documentation updates and step-15 report ID labels (N-14).
- New adversarial re-review in a separate session, scoped to `b8a1b1e..HEAD` (writer ≠ reviewer).
- `acceptance-matrix.md`, then human OK, then `/opsx:archive`.
