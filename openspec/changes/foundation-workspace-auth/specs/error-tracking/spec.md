## ADDED Requirements

### Requirement: Trace id per request
Every panel request SHALL carry a trace id (header `x-trace-id`, generated if absent) available to server code and error reports.

#### Scenario: Trace id generated
- **WHEN** a request arrives without `x-trace-id`
- **THEN** a new id is generated and returned in the response header `x-trace-id`

### Requirement: Redacted error logging
Server-side errors SHALL be stored in `error_logs` with source, level, message, details, trace id, and status `open`, after redacting personal data and secrets.

#### Scenario: Error with personal data
- **WHEN** a server error message contains "DNI 30123456, tel 2945123456, token=abc"
- **THEN** the stored message and details contain masked values and never the raw DNI, phone, or token

#### Scenario: Insert only by server
- **WHEN** an authenticated operator tries to insert into `error_logs` from the browser
- **THEN** the insert is rejected (service role only)

### Requirement: Client error reporting
The browser SHALL report unhandled UI errors to `POST /api/errors/report` with the trace id and an optional user note (max 500 characters), and show the user a short incident code.

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

### Requirement: Retention
Error logs older than 30 days SHALL be purged daily.

#### Scenario: Old errors purged
- **WHEN** the purge job runs
- **THEN** rows with `created_at` older than 30 days are deleted and newer rows remain
