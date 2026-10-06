# Step 20 - Fifth re-review fixes: verification report

- **Change:** `foundation-workspace-auth`
- **Branch:** `feature/foundation-workspace-auth`
- **Date:** 2026-10-05
- **Source findings:** `reports/2026-10-05-adversarial-rereview-5.md` (FAIL: U-1, U-2 Major; U-3, U-4, U-5 minor; U-6, U-7 nit)
- **Design:** `design.md` D16
- **User decisions:** fix U-1 and U-2 with a simpler, conservative key rule, plus U-3, U-4, U-5 and the U-7 docs; U-6 named out of contract. The next re-review (6) is **targeted**: it confirms U-1..U-5 and looks only for realistic secret leaks; new minors go to the backlog and do not block.
- **Review range for the next adversarial pass:** `af2bfe2..HEAD`

## Commits

| Commit | Task | Summary |
|---|---|---|
| `e47bb84` | 20.1 | D16, error-tracking spec (key rule, chained links, arrays and Map entries, `+54-9-…` phones, out-of-contract and over-masking lists), section-20 tasks before code |
| `2493e07` | 20.2–20.5 | Tests first, then: keys containing a key word; chained links masked with the value (skip rule removed); DNI lookahead with the phone end boundary; `9`/`54` hyphen/dot runs left to the phone pass; array values and `=>` separator |
| `38e09ea` | 20.6 | U-7: `ARCHITECTURE_SDD.md` key rule and lists, `STUDENT_DECISION_LOG.md` D16 lesson, `.planning/STATE.md` |

## Finding status

| ID | Status | Evidence |
|---|---|---|
| U-1 | Fixed | Up to 4 chained `word:` / `word=` links after a secret key separator are masked with the value. Tests: `missing key: service_key: …`, `cache key: secret_key: …`, `missing key: session: …`, `missing key: credential: …` → `… key=[redacted]`; T-4 cases still masked whole; corpus tokens |
| U-2 | Fixed | `SECRET_KEY` = contains `token`, `secret`, `passw`, `authorization`, `cookie`, `session`, `credential`, or ends in `key`. Tests: `password_confirmation=…`, `tokenValue=…`, `access_tokens=…`, `token_value: …`, `{"passwordHash":…}`, `{"accessTokenValue":…}`, inspected `{ password_confirmation: '…', refresh_token_hash: '…' }`; `keyboard=qwerty` unchanged |
| U-3 | Fixed | The DNI lookahead declines only when the 4-digit group ends like a phone (`(?![\w-])`). Tests: `DNI 30 123 456 1830hs` → `DNI [dni] 1830hs`, `30 123 456.2024_frente.jpg`, `30 123 456 2026_x`, `30 123 456-2026_x`; corpus glued contexts ` 1830hs`, `.2024_frente.jpg`, ` 2026_x` |
| U-4 | Fixed (in contract) | A `9`/`54` run joined by `-`/`.` followed by the same separator and 4 digits is a phone. Tests: `+54-9-294-445-7788`, `54-294-445-7788`, `9-294-445-7788`, `+54.9.294.445.7788` → `[phone]`; corpus tokens in all contexts and pairs |
| U-4 edge | Out of contract (spec) | Other 1–2 digit prefixes joined by `-`/`.` (`12-294-445-7788` → `[dni]-7788`), under "numbers glued by `-`" |
| U-5 | Fixed | Array value up to the first `]` or newline for JSON and single-quoted keys; `=>` separator for single-quoted keys. Tests: `{"set-cookie":[…]}` → `{"set-cookie":"[redacted]"}`, `{ 'set-cookie': [ … ] }`, `{"token":[…]}`, `Map(1) { 'cookie' => '[redacted]' }` |
| U-6 | Out of contract (spec) | Values that start with a literal `[redacted]` keep their glued tail |
| U-7 | Fixed | (a) D15 alignment claim replaced (D16 key rule); (b) `ARCHITECTURE_SDD.md` says "contains"; (c) the blanks-only phone case names "blanks or a newline"; (d) authorization/cookie `=` lines masked to end of line listed as accepted over-masking |

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 456 passed |
| `npm run test:db` | 136 passed |
| Contract corpus | 0 leaks: 11 new tokens (U-1, U-2, U-4, U-5) and 3 new DNI glued contexts (U-3) added to the separated-context, glued and pair grids |
| Performance | All 200 KB adversarial inputs < 200 ms, including new "key words inside long keys", "unclosed secret arrays", "chained links without a value" |
| Realistic log lines (throwaway probe) | UUID URLs, ISO timestamps, `127.0.0.1:54321`, `13:06`, JSON access logs, `monkey business`, `keyboard`, `note: password_reset requested` unchanged. Over-masking as documented: `tokens_used=[redacted] sessionId=[redacted]`, `Turkey=[redacted]`, `missing key=[redacted]` |
| `GET /login` smoke (dev server) | form rendered with `method="POST"` |
| Report probe (dev server, local test operator) | `POST /api/errors/report` → 201; stored message `wa [phone], missing key=[redacted], password_confirmation=[redacted], {"set-cookie":"[redacted]"}`; no sensitive fragment stored; trace id kept in the URL; probe row deleted (0 `error_logs` rows after cleanup) |

## Notes for the reviewer

- Targeted scope (user decision): confirm U-1..U-5 and look for **realistic secret leaks** against the D14/D15/D16 contract. New personal-data or over-masking minors go to the backlog in `.planning/STATE.md` and do not block archive.
- The key rule now errs toward masking: any key containing a key word hides its value, and chained key names are lost. This is accepted in the spec.
- Deferred backlog unchanged: R-3, R-6, R-10, N-5, N-6, N-7, N-10, N-13 (`.planning/STATE.md`).
