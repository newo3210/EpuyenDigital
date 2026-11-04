# Step 21 - Sixth (targeted) re-review fixes: verification report

- **Change:** `foundation-workspace-auth`
- **Branch:** `feature/foundation-workspace-auth`
- **Date:** 2026-10-05
- **Source findings:** `reports/2026-10-05-adversarial-rereview-6.md` (FAIL: V-1, V-2, V-3 latent secret leaks; V-4 regression of D16; backlog B-1..B-9 non-blocking)
- **Design:** `design.md` D17
- **User decision:** apply the four fixes the reviewer verified on a patched copy, add tests, then a **short confirmation** in a separate session (V-1..V-4 resolved, no regressions) before the acceptance matrix. No further full re-review.
- **Review range for the confirmation:** `d603110..HEAD`

## Commits

| Commit | Task | Summary |
|---|---|---|
| `4f0d722` | 21.1 | D17, error-tracking spec (chunk suffix, multi-line arrays, Bearer before another pair, chained-link rule, out-of-contract B-1, B-2, B-4), section-21 tasks before code |
| `4570745` | 21.2–21.3 | Tests first (B-9), then: Bearer value without quotes/backslash; arrays across lines; JSON and single-quoted passes before header lines; chunk suffix on secret keys; chained links with blanks only for secret keys |
| `750442e` | 21.4 | B-8 and D17 in `ARCHITECTURE_SDD.md`, backlog B-1..B-7 in `.planning/STATE.md`, D17 lesson in `STUDENT_DECISION_LOG.md` |

## Finding status

| ID | Status | Evidence |
|---|---|---|
| V-1 | Fixed | `BEARER_RE` value is `[^\s,;"'\\]`. Tests: `JSON.stringify({ authorization: 'Bearer …', cookie: 'sid=…' })`, with `x-api-key`, and pretty-printed with `apikey`; corpus token `{"authorization":"Bearer …","cookie":"sid=…"}` |
| V-2 | Fixed | `ARRAY_VALUE` is `\[[^\]]{0,4096}\]?`. Tests: multi-line `util.inspect` `set-cookie` array (both elements), `JSON.stringify(…, null, 2)`; corpus token with a multi-line array |
| V-2 follow-up | Fixed (found by the corpus pair grid) | `authorization: …` / `cookie: …` line followed on the same line by a multi-line array cut the `[` and left the elements. The JSON and single-quoted key passes now run before the line passes (D17) |
| V-3 | Fixed | `SECRET_KEY` accepts `(?:\.\d{1,2})?`. Tests: raw cookie string, JSON and inspected `sb-ref-auth-token.0`; corpus token |
| V-4 | Fixed | Chained links cross blanks only for secret keys; other words chain only when glued (`[\w-]{1,80}[=:](?=\S)`). Tests: `token:\nphone: 2945 451234`, `session:\ndni: 30 123 456`, `token: <b64>Q=\nphone: …`, `secret=<b64>Q= 2945 451234` mask the phone/DNI and the secret; U-1 and T-4 cases still masked whole; corpus token |
| B-1, B-2, B-4 | Out of contract (spec) | Cookie objects `{ name, value }`, header-entry arrays, unquoted values with blanks; tracked in `.planning/STATE.md` before the worker logs headers or cookies |
| B-3, B-6, B-7 | Backlog | `.planning/STATE.md` |
| B-5 | Fixed by V-4 | A plain word on the next line is no longer a link |
| B-8, B-9 | Fixed | `ARCHITECTURE_SDD.md`; tests above |

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 469 passed |
| `npm run test:db` | 136 passed |
| Contract corpus | 0 leaks, with 4 new tokens (V-1..V-4) in every separated context and pair |
| Performance | All 200 KB adversarial inputs < 200 ms |
| `GET /login` smoke (dev server) | form rendered with `method="POST"` |
| Report probe (dev server, local test operator) | `POST /api/errors/report` → 201; stored message `{"authorization":"[redacted]","cookie":"[redacted]"} {\n  'set-cookie': '[redacted]'\n} sb-ref-auth-token.0=[redacted] token=[redacted] [phone]`; no sensitive fragment stored; trace id kept in the URL; probe row deleted (0 `error_logs` rows after cleanup) |

## Notes for the confirmation pass

- Confirm only that V-1..V-4 are resolved and that this diff introduced no regression of a listed format in a listed context. Everything else is backlog.
