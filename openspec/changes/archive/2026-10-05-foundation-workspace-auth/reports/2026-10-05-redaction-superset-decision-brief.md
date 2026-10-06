# Decision brief — Redaction "superset of `65eb994`" requirement

- **Change:** `foundation-workspace-auth` (branch `feature/foundation-workspace-auth`)
- **Date:** 2026-10-05
- **Audience:** technical team review
- **Status:** **decided — Option A** (explicit contract), by the user on 2026-10-05 after reviewing the threat model: `error_logs` is internal (`admin`/`support` only, 30-day retention), so secrets are masked strictly and personal data in common formats. Implemented under `design.md` D14
- **Evidence:** `reports/2026-10-05-adversarial-review.md`, `reports/2026-10-05-adversarial-rereview.md`, `reports/2026-10-05-adversarial-rereview-2.md`, `reports/2026-10-05-adversarial-rereview-3.md`, `design.md` D11–D13, `specs/error-tracking/spec.md`

## 1. Summary

Error logs are redacted before storage: secrets and personal data (DNI, CUIT, phones, emails) are replaced by placeholders. After the first adversarial review we rewrote the redaction to make it linear-time (it was exploitable for ReDoS) and to cover Argentine formats. The rewrite changed the shape of every pattern. The second review found that the new version stopped masking some values the old one masked. In response, the spec gained a rule: **the redaction SHALL mask every value that the old version (`65eb994`) masked**.

That rule has now failed two reviews in a row. Each reviewer builds a larger corpus and finds new gaps: 20 leaking cases in round 3 (fixed), 605 in round 4. The problem is not a single bug. We are asking for a property ("superset of another set of regexes") that example-based tests cannot establish. The team needs to decide how we define "complete enough" for redaction, so the change can close.

## 2. Context

### 2.1 What redaction protects

- Unhandled server errors and browser error reports are stored in `error_logs` (retention 30 days, readable by `admin`/`support` only).
- Messages and stacks often carry what a citizen typed (DNI, phone, email) or what a library printed (tokens, cookies, passwords).
- Redaction runs in `packages/shared/src/redact.ts` before every insert. It is the only privacy control on that table.

### 2.2 Hard constraints that shape the code

- **Linear time.** The original patterns (`\s*`, `[^\s&,;]+`, `[A-Z0-9.-]+`) allowed quadratic backtracking: minutes for a 200 KB crafted string. Now every quantifier is bounded and input is capped at 16 384 chars. Budget: < 200 ms for 200 KB adversarial input (measured worst case ~37 ms per 16 KB).
- **Argentine formats.** `(0294) 15-412-3456`, `+54 9 294 …`, DNI with spaces or dots, CUIT, JSON / `key=value` secrets.
- **Correlation.** Trace ids (UUIDs) must survive, or support cannot find the error.

### 2.3 How the requirement evolved

| Round | Verdict | Redaction findings | What we did |
|---|---|---|---|
| Review 1 | FAIL | J-2: missing AR formats and JSON secrets. J-3: quadratic regexes (ReDoS) | D11: rewrite with bounded quantifiers and broader formats |
| Re-review 1 | FAIL | N-3/N-4: the rewrite stopped masking quoted secrets and DNIs glued to `_`/letters | D12: user chose "superset of `65eb994`"; fixed the listed cases |
| Re-review 2 | FAIL | R-1: DNIs next to `digit.` leaked (we had kept IPs/decimals intact without asking) | D13: user chose **strict superset, privacy first**; added a legacy oracle and a 27 × 27 property test |
| Re-review 3 | **FAIL** | S-1: phones after another number leak. S-2: secrets leak (overlap with the `key` suffix, quotes inside values, > 10 blanks). S-3: spec overclaims the guarantee | **This brief** |

## 3. The problem

### 3.1 Concrete leaks found in re-review 3 (all masked by `65eb994`)

| Input | Current output | Cause |
|---|---|---|
| `calle 123 2945 451234` | unchanged | Phone pattern first matches `123 2945 45…` (too few digits), the replacer keeps it, and `String.replace` never revisits the real phone |
| `dni 30123456 11 4567 8901` | `dni [phone] 4567 8901` | Same mechanism: the DNI plus the area code is taken as a "phone", and the rest of the number is left |
| `missing key: token: abc123secret` | `missing key=[redacted] abc123secret` | Broadened `…key` suffix consumes `key: token:` as a secret pair; the real `token:` is skipped |
| `password=Abc'123!xyz` | `password=[redacted]'123!xyz` | Bare value stops at a quote (needed to support quoted values) |
| `password:` + 11 spaces + value | unchanged | Bounded `\s{0,10}` (needed for linear time) |

### 3.2 Root causes

1. **Two different pattern families.** `65eb994` used simple, unbounded patterns: a phone always ended in exactly 4 digits, and a secret value was anything up to whitespace or `&,;`. The current patterns are bounded and accept more shapes, which makes them match differently. Every structural difference creates inputs where the old one wins.
2. **Left-to-right replacement consumes text.** When a candidate match is rejected by the replacer (for example a phone with fewer than 10 digits), the regex engine has already moved past it. Old and new patterns choose different starting points, so they "see" different numbers.
3. **Bounded quantifiers are a deliberate semantic change.** `\s{0,10}`, `{1,4096}` and the 16 KB cap exist for ReDoS safety. Beyond those bounds the old unbounded patterns matched and the new ones cannot (R-3, N-5, part of S-2).
4. **Tests prove examples, not a superset.** The property test checks 27 tokens × 27 contexts. A reviewer with a different generator (numbers next to the token, two tokens, more blanks) finds new cases. A superset over the *infinite* input space is not something example tests can prove.

### 3.3 Why it matters

- **Privacy:** S-1 and S-2 are real leaks of phones and passwords into a table that support staff read.
- **Delivery:** the change has been "functionally done" since step 14. Every round costs a spec update, TDD fixes, a verification and a new review. Without a finite acceptance criterion, a fourth review is likely to find more.

## 4. Options

### Option A — Explicit contract instead of an absolute superset

Replace the rule "mask everything `65eb994` masked" with a finite, executable contract:

- The spec lists the required formats (already there) **and** declares the property-test corpus as part of the contract.
- The corpus is extended with the generators that found S-1/S-2: a number before or after the token, two tokens in a row, blank runs, quotes inside values, overlapping `key` prefixes.
- S-1 and S-2 (a), (b) are fixed in code.
- Known, accepted exceptions are listed by name: R-3 (secret tails over 4 096 chars, `password=""x`), N-5 (a value split by the 16 KB cut), N-7 (emails with a local part over 64 chars or more than 9 domain labels), S-2 (c) (more than 10 blanks).

| | |
|---|---|
| Pros | Finite and testable; ends the moving target; new reviewer finds become format requests, not spec violations |
| Cons | No formal guarantee against `65eb994`; a different generator can still find inputs the old code masked |
| Effort / risk | ~0.5 day / low |

### Option B — Superset by construction (union of both redactions)

Run the old redaction (with bounded quantifiers) and the current one on the **original** text, collect the character ranges each would mask, and mask the union. Render one placeholder per merged range.

| | |
|---|---|
| Pros | Superset of `65eb994` holds by construction, up to the bounds that linear time forces (R-3/N-5 class) |
| Cons | Rewrites `redactText` into a span engine (secrets-first ordering must be emulated with ranges); two pattern families to maintain forever; roughly double the cost per string; more over-masking (old patterns also hit timestamps and ids); bounding the old patterns already breaks exact equivalence |
| Effort / risk | ~1.5–2 days / medium (performance and placeholder merging) |

### Option C — Keep the spec, patch S-1/S-2, review again

| | |
|---|---|
| Pros | Smallest immediate change |
| Cons | No termination criterion; each round has found more cases (20, then 605) |
| Effort / risk | ~0.5 day per round / high (likely another FAIL) |

### Option D — "Deny by default" for numbers, explicit contract for secrets

Change the numeric policy instead of chasing formats:

- Mask **every maximal run of digits joined by single separators** (one whitespace character, `.`, `-`, `/`, parentheses, optional `+`) whose total digit count is ≥ 7. This removes DNI, CUIT and phones in any format, including S-1, R-1 and N-6, because any old DNI/CUIT/phone match lies inside such a run.
- Exempt only known safe shapes, removed before the scan: UUIDs (already done), ISO dates and times (`2026-10-05`, `13:06:36`), and the `digestRef` (letters only).
- A single-pass scanner keeps it linear without unbounded regexes.
- Secrets follow Option A (explicit contract plus fixes for S-2 (a), (b)).

| | |
|---|---|
| Pros | Numeric superset by construction, which is where most leaks were (S-1, R-1, N-4, N-6); simpler than the current phone/DNI patterns; matches the user's "privacy first" decision |
| Cons | More over-masking: dotted IPs (already accepted), epoch milliseconds, long order numbers or amounts with 7+ digits, numeric ids in URLs. Support loses those values in logs. Labelled placeholders become less precise (one `[number]` instead of `[dni]` / `[phone]` / `[cuit]`, unless we classify after masking) |
| Effort / risk | ~1 day / low–medium (mostly test rewrites; placeholder naming to decide) |

### Comparison

| | A | B | D |
|---|---|---|---|
| Guarantee against `65eb994` | corpus only | by construction (bounded) | numbers by construction; secrets corpus |
| Ends review loop | yes | yes | yes |
| Over-masking | as today | higher | highest for numbers |
| Code complexity | as today | high | lower for numbers |
| Effort | ~0.5 day | ~1.5–2 days | ~1 day |

## 5. Recommendation

**Option D** for numbers combined with **Option A** for secrets. Most leaks in every round were numeric. D removes the whole class instead of adding exceptions. The cost is over-masking of numbers that support rarely needs, and correlation is protected by the UUID exemption and `digestRef`. If the team prefers keeping `[dni]` / `[phone]` labels and today's precision, **Option A** alone is the low-cost path, as long as everyone accepts that the guarantee is "the contract corpus", not "everything `65eb994` did".

We do not recommend B: it locks in a deprecated pattern set and doubles maintenance. We do not recommend C: it has no stopping point.

## 6. Questions for the team

1. Which acceptance criterion do we adopt for redaction: A, B, C, D, or A+D?
2. If D: is it acceptable to mask epoch milliseconds, long order numbers or amounts, and numeric URL ids in error logs? One generic placeholder, or classified (`[dni]` / `[phone]` / `[cuit]` / `[number]`)?
3. Do we accept the listed exceptions (R-3, N-5, N-7, S-2 (c)) as permanent, or schedule them?
4. Who signs off the final contract: the human OK at archive time, or a separate security review?

## 7. Not blocked by this decision (proceeding)

Approved by the user and independent of the redaction strategy:

- **S-4:** profile name length counted in code points everywhere; row validation never stricter than the database (today an operator can save a name the DB accepts but `profileSchema` rejects, which locks them out of the panel).
- **S-5:** complete the invisible-character set (variation selectors supplement U+E0100–E01EF and similar).
- **S-7:** pgTAP cases for a zero window and a negative limit.

These depend on the decision and wait for it: **S-6** (UUIDs glued to `_` are not exempt), because Option D changes the UUID handling; and **S-3** (spec/docs wording), because it depends on which guarantee we adopt.

## Appendix — Patterns side by side

| Pattern | `65eb994` | Current |
|---|---|---|
| Phone | `(?<![\w+-])(?:\+?54[\s-]?)?(?:9[\s-]?)?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{4}(?![\w-])` | adds `0?` area prefix, parentheses, `15`, `.` separator, last group `\d{2,4}` |
| DNI | `(?<![\d-])(?:\d{1,2}\.\d{3}\.\d{3}\|\d{7,8})(?![\d-])` | `(?<!\d)\d{1,2}([.\s-]?)\d{3}\1\d{3}(?!\d)`, run only between UUID tokens |
| Secret `key=value` | `\b([\w-]*(?:token\|api[_-]?key\|passw(?:or)?d\|secret))\s*[=:]\s*[^\s&,;]+` | key `[\w-]{0,40}(?:token\|secret\|passw(?:or)?d\|key)`, blanks `\s{0,10}`, value quoted (with escapes) or bare `[^\s&,;"']{1,4096}` |
| Email | `[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}` | local part `{1,64}`, up to 8 extra labels |
| Input cap | none | 16 384 chars |
