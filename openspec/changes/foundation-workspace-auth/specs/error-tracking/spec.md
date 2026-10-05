## ADDED Requirements

### Requirement: Trace id per request
Every panel request SHALL carry a trace id (header `x-trace-id`, generated if absent) available to server code and error reports.

#### Scenario: Trace id generated
- **WHEN** a request arrives without `x-trace-id`
- **THEN** a new id is generated and returned in the response header `x-trace-id`

### Requirement: Redacted error logging
Server-side errors SHALL be stored in `error_logs` with source, level, message, details, trace id, and status `open`, after redacting personal data and secrets. Redaction SHALL cover at least: emails; CUIT; Argentine phones with optional `+54`, optional `9`, optional `0`-prefixed area code, optional `15` mobile prefix, parentheses around the area code, and space, dot, or hyphen separators; DNI as 7–8 digits plain, dotted, spaced, or hyphenated; secrets as `key=value`, `key: value`, and JSON `"key": "value"` for keys containing `token`, `secret`, or `passw`, or ending in `key` (`key`, `apikey`, `api_key`, `service_key`), plus bare Supabase secret keys (`sb_secret_…`) and JWTs. Secret values SHALL be masked whether bare, double-quoted, or single-quoted (including escaped quotes), and DNIs SHALL be masked when adjacent to letters, `_`, `.`, or digit-dot sequences (for example versioned file names), even if that partially masks dotted IP addresses or decimals. Outside canonical UUID tokens (which are system identifiers and SHALL be left intact), redaction SHALL mask every value that the `65eb994` redaction masked. Inputs SHALL be truncated to a bounded size before redaction, and redaction SHALL run in time linear in the input size. When the failing request has a signed-in active operator, the row SHALL carry that operator's `org_id` and `user_id`.

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

#### Scenario: Superset of the previous redaction
- **WHEN** any corpus text outside UUID tokens no longer contains a personal-data or secret token after the `65eb994` redaction
- **THEN** it does not contain that token after the current redaction either

#### Scenario: UUIDs stay intact
- **WHEN** a logged text contains a random UUID, alone or inside a URL such as `/support/errors?id=<uuid>`
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
