## ADDED Requirements

### Requirement: Trace id per request
Every panel request SHALL carry a trace id (header `x-trace-id`, generated if absent) available to server code and error reports.

#### Scenario: Trace id generated
- **WHEN** a request arrives without `x-trace-id`
- **THEN** a new id is generated and returned in the response header `x-trace-id`

### Requirement: Redacted error logging
Server-side errors SHALL be stored in `error_logs` with source, level, message, details, trace id, and status `open`, after redacting personal data and secrets. Redaction SHALL cover at least: emails; CUIT; Argentine phones with optional `+54`, optional `9`, optional `0`-prefixed area code, optional `15` mobile prefix, parentheses around the area code, and space, dot, or hyphen separators; DNI as 7–8 digits plain, dotted, spaced, or hyphenated; secrets as `key=value`, `key: value`, JSON `"key": "value"`, single-quoted `'key': 'value'`, and `util.inspect` Map entries `'key' => 'value'` for keys containing `token`, `secret`, `passw`, `authorization`, `cookie`, `session`, or `credential` (`password_confirmation`, `passwordHash`, `refresh_token_hash`), or ending in `key` (`key`, `apikey`, `api_key`, `x-api-key`, `service_key`); whole authorization and cookie lines (`authorization: …`, `authorization=…`); plus bare Supabase secret keys (`sb_secret_…`) and JWTs. Secret values SHALL be masked whether bare, double-quoted, single-quoted (including escaped quotes), or an array under a JSON or single-quoted key (`{"set-cookie":["sid=…"]}`), and DNIs SHALL be masked when adjacent to letters, `_`, `.`, or digit-dot sequences (for example versioned file names), even if that partially masks dotted IP addresses or decimals. Redaction SHALL follow an explicit contract (design D14): every listed format SHALL be masked when it stands alone or is surrounded by blanks, punctuation, quotes, brackets, URL or JSON syntax, newlines, other numbers, or other personal-data values (for example `calle 123 2945 451234` or `dni 30123456 11 4567 8901`). Secret values SHALL be masked whole even when they contain quotes, and when up to 4 chained `word:` or `word=` links follow the separator they SHALL be masked together with the final value (`missing key: service_key: abc123secret` → `missing key=[redacted]`). Phones SHALL be masked whole with 2-, 3-, or 4-digit area codes and 3- or 4-digit last groups (`+54 9 294 445-1234`, `+54-9-294-445-7788`, `2945 451 234`). Canonical UUID tokens are system identifiers and SHALL be left intact, also when glued to `_`, letters, or digits. The following cases are out of contract and accepted: the tail of secret values longer than 4 096 characters and a value glued after an empty quoted pair (`password=""x`) (R-3); a value split by the input cut (N-5); emails with a local part over 64 characters or more than 9 domain labels (N-7); more than 10 blanks around a secret separator or after `Bearer`/`authorization`; secret key prefixes over 40 characters; JWTs with a header over 512 or a segment under 4 characters outside Authorization/Bearer lines; numbers glued by `-` to other digits or identifiers, including a hyphen- or dot-joined phone preceded by a 1–2 digit number other than `9` or `54`; secret values containing `&`, `,`, `;`, or an unbalanced quote, which are cut at that character; array elements containing `]`, which are cut there; more than 4 chained key links before a secret value; values that start with a literal `[redacted]` placeholder, whose glued tail stays (`password=[redacted]abc`, extra segments of a token with more than three JWT segments); a blank-separated DNI followed by a lone 4-digit number, which keeps its 2-digit prefix (`30 [phone]`); and a 3-digit-area phone written only with blanks and followed by blanks or a newline and another number (`9 294 445 1234 30123456`), whose last group may stay visible. Over-masking is accepted: keys such as `sessionId` or `tokens_used` hide their values, chained key names are lost, and authorization or cookie lines (also with `=`, as in query strings) are masked to the end of the line. Inputs SHALL be truncated to a bounded size before redaction, and redaction SHALL run in time linear in the input size. When the failing request has a signed-in active operator, the row SHALL carry that operator's `org_id` and `user_id`.

#### Scenario: Error with personal data
- **WHEN** a server error message contains "DNI 30123456, tel 2945123456, token=abc"
- **THEN** the stored message and details contain masked values and never the raw DNI, phone, or token

#### Scenario: Argentine formats and JSON secrets
- **WHEN** a logged text contains `02945-15-123456`, `(02945) 451234`, `+54 (2945) 451234`, `2945.451234`, DNI `30 123 456` or `30-123-456`, and `{"refresh_token":"abc123xyzSECRET"}`
- **THEN** every phone, DNI, and secret value is masked

#### Scenario: Quoted secrets and glued DNIs
- **WHEN** a logged text contains `password="hunter2pass"`, `{ password: 'hunter2pass' }`, `token: "abc"`, `{"password":"hun\"ter2"}`, `dni_30123456.pdf`, `30123456_frente.jpg`, `nro.30123456`, or `Doc.30.123.456`
- **THEN** every secret value and DNI is masked

#### Scenario: DNIs next to digits and dots
- **WHEN** a logged text contains `30123456.1.pdf`, `dni_30123456.2024.pdf`, `v2.30123456`, `0.30123456`, `1.30.123.456`, or `x 1234567.89`
- **THEN** every DNI is masked

#### Scenario: Phones next to other numbers
- **WHEN** a logged text contains `calle 123 2945 451234`, `123 294 445 1234`, `2026 011 4555-6677`, `dni 30123456 11 4567 8901`, `30123456` and `011 4567 8901` on consecutive lines, `+54 9 294 445-1234`, `nro 12 294 445 1234`, `2026-10-05 294 445-1234`, `2945 451 234`, `+54-9-294-445-7788`, `+54.9.294.445.7788`, or `DNI 30 123 456 1830hs`
- **THEN** every phone is masked whole as a phone and every DNI is masked

#### Scenario: Secrets with quotes or after a key word
- **WHEN** a logged text contains `password=Abc'123!xyz`, `token=ab"cdefgh`, `missing key: token: abc123secret`, `config key: secret = s3cr3tvalue`, `password=monkey:Zx91`, `password: Turkey=2024!`, `missing key: service_key: abc123secret`, `missing key: session: abc123secret`, `password_confirmation=hunter2pass`, `{"passwordHash":"h4shvalue"}`, or `{ refresh_token_hash: 'abc123hash' }`
- **THEN** every secret value is masked whole

#### Scenario: Serialized headers and inspected objects
- **WHEN** a logged text contains `{"authorization":"Basic dXNlcjpwYXNz"}`, `{"Authorization": "Token abc123opaque"}`, `authorization=Basic dXNlcjpwYXNz`, `{"cookie":"sid=abc123def"}`, `{ 'x-api-key': 'sk_live_abc123' }`, `missing key: 'token': abc123secret`, `{"set-cookie":["sid=abc123def; Path=/"]}`, `{ 'set-cookie': [ 'sid=abc123def' ] }`, or `Map(1) { 'cookie' => 'sid=abc123def' }`
- **THEN** every credential is masked

#### Scenario: Redaction contract corpus
- **WHEN** any personal-data or secret token of the contract corpus appears in any separated context, next to other numbers, or paired with another token (DNIs also in glued contexts)
- **THEN** the redacted text does not contain that token

#### Scenario: UUIDs stay intact
- **WHEN** a logged text contains a random UUID, alone, inside a URL such as `/support/errors?id=<uuid>`, or glued to `_`, letters, or digits such as `avatar_<uuid>.png`, `id<uuid>`, or `<uuid>abc`
- **THEN** the UUID is unchanged

#### Scenario: Oversized input
- **WHEN** a 200 KB message or stack is logged
- **THEN** it is truncated before redaction and logging completes in under 200 ms

#### Scenario: Server error with signed-in operator
- **WHEN** an unhandled server error happens during a request of an active operator
- **THEN** the stored row has that operator's `org_id` and `user_id`, so admins of the organization can see it

#### Scenario: Insert only by server
- **WHEN** an authenticated operator tries to insert into `error_logs` from the browser
- **THEN** the insert is rejected (service role only)

### Requirement: Client error reporting
The browser SHALL report unhandled UI errors to `POST /api/errors/report` with the trace id and an optional user note (max 500 characters), and show the user a short incident code. The endpoint SHALL authenticate the caller before reading the body, reject bodies larger than 16 KB, and accept at most 10 reports per user per minute. The limit SHALL count a dedicated origin column (never a key inside truncatable details) and SHALL be checked and applied atomically in the database, so concurrent requests cannot exceed it. The database function SHALL reject a missing user, a missing or non-positive limit, and a missing or non-positive window instead of storing without a limit. Trace ids are correlation hints chosen by the client, not integrity proofs.

#### Scenario: Anonymous report
- **WHEN** a request without a valid session posts a report
- **THEN** the endpoint responds 401 without parsing the body and stores nothing

#### Scenario: Oversized report
- **WHEN** an authenticated operator posts a body larger than 16 KB
- **THEN** the endpoint responds 413 and stores nothing

#### Scenario: Report flood
- **WHEN** an authenticated operator posts an 11th report within one minute
- **THEN** the endpoint responds 429 and stores nothing

#### Scenario: Maximum-size reports still count
- **WHEN** an authenticated operator posts 11 valid reports of about 9.5 KB each (details truncated on storage) within one minute
- **THEN** the 11th responds 429

#### Scenario: Concurrent flood
- **WHEN** an authenticated operator sends 50 reports concurrently
- **THEN** at most 10 are stored and the rest respond 429

#### Scenario: Invalid limit arguments
- **WHEN** the report function is called with a null user, a null or zero limit, or a null or zero window
- **THEN** it raises `invalid_argument` and stores nothing

#### Scenario: UI crash
- **WHEN** a panel page throws during render
- **THEN** the error boundary shows "Ocurrió un error. Código: XXXXXXXX" (first 8 characters of the trace id) and an `error_logs` row with source `web` is created

#### Scenario: Mismatched trace id
- **WHEN** the report body trace id differs from the request header trace id
- **THEN** the endpoint responds 400 and stores nothing

### Requirement: Support screen
Users with role `admin` or `support` SHALL list, filter (status, source, level, date), and open errors at `/support/errors`, and change status to `acknowledged` or `resolved`.

#### Scenario: Resolve an error
- **WHEN** a support user marks an open error as resolved
- **THEN** status becomes `resolved`, `resolved_by` and `resolved_at` are set automatically, and no other field changes

#### Scenario: Immutable fields
- **WHEN** an update tries to change the message of an error
- **THEN** the update is rejected

#### Scenario: Impossible filter date
- **WHEN** a support user opens `/support/errors?from=2026-02-31` or `?to=0000-01-01` (year outside 2000–2100)
- **THEN** the invalid date is ignored and the list renders without that filter

### Requirement: Retention
Error logs older than 30 days SHALL be purged daily.

#### Scenario: Old errors purged
- **WHEN** the purge job runs
- **THEN** rows with `created_at` older than 30 days are deleted and newer rows remain

#### Scenario: Purge scheduled
- **WHEN** the migrations are applied on a database with `pg_cron`
- **THEN** a job `purge-error-logs` runs `purge_error_logs()` daily at 06:00 UTC
