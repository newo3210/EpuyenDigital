## Confirmation pass: V-1..V-4 fixes (short, user decision)

**Scope**: OpenSpec change `foundation-workspace-auth`, branch `feature/foundation-workspace-auth`, fix diff `git diff d603110..HEAD` (commits `4f0d722`, `4570745`, `750442e`, `2d2c812`). Reviewed 2026-10-05 by an independent session (writer != reviewer). Sources: `reports/2026-10-05-adversarial-rereview-6.md` (findings and reproductions), `reports/2026-10-05-step-21-rereview-6-fixes.md` (author's claims, re-checked rather than trusted), `design.md` D17, `specs/error-tracking/spec.md`, `packages/shared/src/redact.ts`.

Only two questions were checked: (1) are V-1..V-4 resolved, and (2) does this diff regress a listed format in a listed context. Everything else is backlog and does not change the verdict.

### Verdict

**PASS.** All V-1..V-4 reproductions are masked at HEAD, and every one of them leaked at `d603110`. A differential fuzz against `d603110` found no regression that leaks listed data. The required chain cases are still masked whole.

### V-1..V-4

| ID | Status | Evidence (real serializer output, secrets built at runtime) |
|---|---|---|
| V-1 | **Resolved** | `JSON.stringify(Object.fromEntries(new Headers({ authorization: 'Bearer …', cookie: 'sid=…', 'x-api-key': '…', accept })))` gives `{"accept":"application/json","authorization":"[redacted]","cookie":"[redacted]","x-api-key":"[redacted]"}`. Also masked: the pretty-printed (`null, 2`) and `", "`-spaced variants, axios-style `{"Authorization":"Bearer …","apikey":"…"}`, and escaped JSON. |
| V-2 | **Resolved** | `util.inspect({ 'content-type', 'set-cookie': [<~120-char connect.sid>, <sb-…-auth-token.0=base64-…>] })` (multi-line) gives `'set-cookie': '[redacted]'` with no element visible. The same holds for `inspect({ 'set-cookie': headers.getSetCookie() })`, `JSON.stringify({ 'set-cookie': [...] }, null, 2)`, and a `cookie:` line followed by the multi-line object (the D17 pass-order follow-up). |
| V-3 | **Resolved** | Names come from the real `@supabase/ssr` `createChunks('sb-<ref>-auth-token', <~6 KB session>)`, which gives `.0` and `.1`. Raw `sb-…-auth-token.0=[redacted]; sb-…-auth-token.1=[redacted]`, JSON `{"sb-…-auth-token.0":"[redacted]",…}`, and inspected `'sb-…-auth-token.0': '[redacted]'` are all masked. |
| V-4 | **Resolved** | `token:\nphone: 2945 451234` gives `token=[redacted] [phone]`. `session:\ndni: 30 123 456` gives `session=[redacted] [dni]`. `token: <b64>Q=\nphone: …` gives `token=[redacted]\nphone: [phone]`. `secret=<b64>Q= 2945 451234` gives `secret=[redacted] [phone]`. `invalid token: dni: 30 123 456` gives `invalid token=[redacted] [dni]`. `token: <b64>Q= (apikey: <s>)` gives `token=[redacted] (apikey=[redacted]`. |

These stay masked whole at HEAD (and did at `d603110`): `missing key: service_key: …`, `missing key: session/credential/x-api-key/token: …`, `password: Turkey=2024!`, `password=monkey:Zx91`, `password=monkey: Zx91`, `config key: secret = …`, `token: id=…`, `key: a=b=c=…`, and `invalid cookie: sb-ref-auth-token.1: …`.

### Regression check

- **Differential fuzz, HEAD vs `d603110`.** 3 seeds × 200 000 random inputs. Each input mixes 2–5 fragments: listed secret forms (`k=v`, `k: v`, JSON, single-quoted, Map `=>`, single-line and multi-line arrays, `Headers` JSON with Bearer, authorization/cookie lines, chains with secret and glued links, empty secret values) over 18 secret keys including `.0`/`.1` chunk names, and listed personal data (plain, dotted, spaced and hyphenated DNI, CUIT, phones in 6 formats, emails). The fragments are joined by 27 listed contexts (blanks, newlines, punctuation, quotes, brackets, JSON, other numbers, `phone:`/`dni:`/`user:` words). A regression means a marker is visible at HEAD and masked at `d603110`. **Result: 0 / 600 000.** Sensitivity check: in the reverse direction (old vs new), 3 594 of 20 000 inputs are flagged, so the harness does detect leaks.
- **(a) Pass order** (JSON and single-quoted passes before the authorization/cookie line passes). I targeted Basic and Token schemes in JSON next to `cookie`/`x-api-key`, an authorization line followed by a JSON pair on the same line, a cookie line followed by a quoted pair, `set-cookie:` lines, `?authorization=…&…` queries, `util.inspect` of `Headers` and `Request`, a multi-line quoted value or array running into an authorization line (both orders), and escaped JSON. Nothing leaks. Three of these leaked at `d603110` and are masked now.
- **(b) Chained-link rule.** Every required case is masked whole (see above). `token=`/`password:`/`apikey:` with an empty value followed on the next line by an email, CUIT, dotted DNI or phone: all masked. The only new difference is the intended narrowing in the current spec: a non-secret word followed by a blank is no longer a link (backlog item 1). The spec does not list it, so it does not count as a regression.
- **Linear time.** 8 crafted 200 KB inputs (secret-key link chains, glued chains, key-word runs, unclosed arrays, chunk-suffix runs, Bearer quotes, 10-blank separators). Worst case **27.3 ms**, against a 200 ms budget.

### Backlog (non-blocking)

1. **Chain narrowing (D17, intended).** `password: user: <v>` gives `password=[redacted] <v>`; `d603110` masked it whole. The current spec promises chains only through secret-key links or glued `word=`/`word:` links. The human should know this is a contract narrowing compared with D16.
2. **Pre-existing, unchanged.** An empty secret value followed by a bracketed spaced phone: `token= (2945 451234)` gives `token=[redacted] 451234)`.
3. **Pre-existing, unchanged.** A spaced DNI under a secret-like key keeps its last groups: `session_id: 30 123 456` gives `session_id=[redacted] 123 456`. It also happens after an empty secret (`token:\nsession_id: …`).
4. **Theoretical (new with D17 multi-line arrays).** An unclosed `[` under a secret key now consumes up to 4 096 characters across lines. If that limit falls in the middle of a later secret pair, the tail of that pair could stay visible. This needs more than 4 KB without any `]`. I did not reproduce it with realistic input.

### Verification commands

| Command | Result |
|---|---|
| `git log --oneline -6`, `git diff --stat d603110..HEAD`, diff of `redact.ts` and the spec | 4 commits, 9 files; `redact.ts`: Bearer value class, `ARRAY_VALUE` spans lines, chunk suffix `(?:\.\d{1,2})?`, chain rule, pass order |
| `npx tsx scripts/.tmp-confirm.ts` (deleted): 27 cases using real `Headers`, `util.inspect`, `@supabase/ssr` `createChunks` | 18 V-1..V-4 reproductions masked at HEAD (all leaked at `d603110`); 9 must-stay-whole chains masked |
| `npx tsx scripts/.tmp-diff.ts` (deleted), seeds 1, 777, 99991 × 200 000 | 0 regressions; reverse direction flags 3 594/20 000 |
| `npx tsx scripts/.tmp-edge.ts` (deleted): 30 targeted pass-order and chain cases, plus timing | No listed-format regression; worst 27.3 ms on 200 KB |
| `npm test` | **469 passed** (matches the author's report) |
| `npm run typecheck` / `npm run lint` | exit 0 / exit 0 |

All `scripts/.tmp-*` probes and the `d603110` copy were deleted. I did not run `db:reset`. I did not read or print `.env.local` or any secret, and I did not modify production code, tests, specs or docs. Fixtures were built at runtime.
