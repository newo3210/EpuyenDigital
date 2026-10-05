## ADDED Requirements

### Requirement: Trace id per request
Every panel request SHALL carry a trace id (header `x-trace-id`, generated if absent) available to server code and error reports.

#### Scenario: Trace id generated
- **WHEN** a request arrives without `x-trace-id`
- **THEN** a new id is generated and returned in the response header `x-trace-id`

### Requirement: Redacted error logging
Server-side errors SHALL be stored in `error_logs` with source, level, message, details, trace id, and status `open`, after redacting personal data and secrets. Redaction SHALL cover at least: emails; CUIT; Argentine phones with optional `+54`, optional `9`, optional `0`-prefixed area code, optional `15` mobile prefix, parentheses around the area code, and space, dot, or hyphen separators; DNI as 7–8 digits plain, dotted, spaced, or hyphenated; secrets as `key=value`, `key: value`, and JSON `"key": "value"` for keys containing `token`, `secret`, or `passw`, or ending in `key` (`key`, `apikey`, `api_key`, `service_key`), plus bare Supabase secret keys (`sb_secret_…`) and JWTs. Inputs SHALL be truncated to a bounded size before redaction, and redaction SHALL run in time linear in the input size. When the failing request has a signed-in active operator, the row SHALL carry that operator's `org_id` and `user_id`.

#### Scenario: Error with personal data
- **WHEN** a server error message contains "DNI 30123456, tel 2945123456, token=abc"
- **THEN** the stored message and details contain masked values and never the raw DNI, phone, or token

#### Scenario: Argentine formats and JSON secrets
- **WHEN** a logged text contains `02945-15-123456`, `(02945) 451234`, `+54 (2945) 451234`, `2945.451234`, DNI `30 123 456` or `30-123-456`, and `{"refresh_token":"abc123xyzSECRET"}`
- **THEN** every phone, DNI, and secret value is masked

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
The browser SHALL report unhandled UI errors to `POST /api/errors/report` with the trace id and an optional user note (max 500 characters), and show the user a short incident code. The endpoint SHALL authenticate the caller before reading the body, reject bodies larger than 16 KB, and accept at most 10 reports per user per minute. Trace ids are correlation hints chosen by the client, not integrity proofs.

#### Scenario: Anonymous report
- **WHEN** a request without a valid session posts a report
- **THEN** the endpoint responds 401 without parsing the body and stores nothing

#### Scenario: Oversized report
- **WHEN** an authenticated operator posts a body larger than 16 KB
- **THEN** the endpoint responds 413 and stores nothing

#### Scenario: Report flood
- **WHEN** an authenticated operator posts an 11th report within one minute
- **THEN** the endpoint responds 429 and stores nothing

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
- **WHEN** a support user opens `/support/errors?from=2026-02-31`
- **THEN** the invalid date is ignored and the list renders without that filter

### Requirement: Retention
Error logs older than 30 days SHALL be purged daily.

#### Scenario: Old errors purged
- **WHEN** the purge job runs
- **THEN** rows with `created_at` older than 30 days are deleted and newer rows remain

#### Scenario: Purge scheduled
- **WHEN** the migrations are applied on a database with `pg_cron`
- **THEN** a job `purge-error-logs` runs `purge_error_logs()` daily at 06:00 UTC
