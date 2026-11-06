## ADDED Requirements

### Requirement: Admin configures WhatsApp lines
An active `admin` SHALL create and update WhatsApp lines for their organization with name, display phone, Evolution base URL, Evolution instance id (unique), optional `default_area_id` (area of the same org), and connection metadata. Non-admins SHALL NOT mutate lines. Operators MAY read non-secret line fields of their organization.

#### Scenario: Admin creates a line with default area
- **WHEN** an admin creates a line with a valid Evolution instance and sets `default_area_id` to Mesa de Entrada
- **THEN** the line is stored and subsequent reads show that default area

#### Scenario: Non-admin cannot create a line
- **WHEN** an `operator` attempts to create a WhatsApp line
- **THEN** the operation is denied and no row is inserted

### Requirement: Encrypted line secrets
API key and webhook secret SHALL be stored only as ciphertext (or equivalent secret storage) in `whatsapp_line_secrets` (or successor). Cleartext secrets SHALL NOT be returned on list/get after save. Updates MAY replace secrets when a new value is submitted. RLS SHALL deny authenticated clients direct table access to secrets; only service-role / controlled server paths write and use them.

#### Scenario: Secrets not echoed after save
- **WHEN** an admin saves an API key and webhook secret then reloads the line form
- **THEN** the form indicates secrets are set without showing the cleartext values

### Requirement: Connection test and status
An admin SHALL be able to run a connection test against Evolution for a line. The system SHALL update `status` (`connected` / `disconnected` / equivalent) and `last_status_at` from the test result (and from CONNECTION_UPDATE webhooks when handled).

#### Scenario: Successful connection test
- **WHEN** an admin runs “Probar conexión” on a correctly configured line
- **THEN** the line status becomes connected (or the documented success status) and `last_status_at` is updated

#### Scenario: Failed connection test
- **WHEN** an admin runs the test with invalid credentials or unreachable Evolution
- **THEN** the line status reflects disconnected/error and the UI shows a non-secret error summary

### Requirement: Seed default area on existing Inspectoría line
Seed SHALL set the existing Epuyén Inspectoría line’s `default_area_id` to the Mesa de Entrada area when present (shared line until a second number exists), without breaking pet registration secrets.

#### Scenario: Seed links line to Mesa de Entrada
- **WHEN** seed runs for org `epuyen`
- **THEN** the Inspectoría WhatsApp line has `default_area_id` equal to the Mesa de Entrada area id
