# operator-auth Specification

## Purpose
Operator sign-in, sessions, route protection, and role checks for the panel. Introduced by change `foundation-workspace-auth` (archived 2026-10-05).

## Requirements

### Requirement: Email and password login
The system SHALL let an operator sign in with email and password at `/login`.

#### Scenario: Valid credentials
- **WHEN** an active operator submits correct email and password
- **THEN** the operator is redirected to the panel home (`/inbox`) and sees their name in the top bar

#### Scenario: Invalid credentials
- **WHEN** the submitted email or password is wrong
- **THEN** the login page shows "Email o contraseña incorrectos." without revealing which field failed

#### Scenario: Invalid input
- **WHEN** the email is not a valid address or the password is empty
- **THEN** the form shows field-level validation errors and no request is sent

#### Scenario: Submit before JavaScript loads
- **WHEN** the login form is submitted before the page's JavaScript has loaded
- **THEN** the browser sends the credentials in a POST body to the server and the email and password never appear in the URL

### Requirement: Persistent session
The session SHALL persist across page reloads and browser restarts until logout or token expiry, refreshing tokens transparently.

#### Scenario: Reload keeps session
- **WHEN** a signed-in operator reloads any panel page
- **THEN** the page renders without redirecting to `/login`

### Requirement: Route protection
Every panel route SHALL require an authenticated, active operator with a profile; unauthenticated requests SHALL redirect to `/login`, preserving the requested path.

#### Scenario: Anonymous access
- **WHEN** an anonymous user opens `/inbox`
- **THEN** they are redirected to `/login?next=/inbox`

#### Scenario: Return after login
- **WHEN** the user logs in from `/login?next=/support/errors` with a role allowed to see that page
- **THEN** they land on `/support/errors`

#### Scenario: Unsafe next parameter
- **WHEN** `next` points to an external URL
- **THEN** it is ignored and the user lands on `/inbox`

### Requirement: Inactive or orphan accounts are locked out
An authenticated user whose profile is inactive or missing SHALL be signed out and shown an explanation.

#### Scenario: Inactive profile
- **WHEN** a user with `is_active = false` signs in with valid credentials
- **THEN** the session is terminated and the login page shows "Tu usuario está desactivado. Consultá con un administrador."

#### Scenario: Missing profile
- **WHEN** a Supabase Auth user without a profile row signs in
- **THEN** the session is terminated and the login page shows "Tu usuario no tiene un perfil asignado."

### Requirement: Role-restricted pages
Pages SHALL declare allowed roles; a signed-in operator without the role SHALL see a "sin permiso" page instead of the content.

#### Scenario: Operator opens support screen
- **WHEN** a user with role `operator` opens `/support/errors`
- **THEN** a "No tenés permiso para ver esta sección." page is shown with HTTP status 403

### Requirement: Logout
The system SHALL let an operator sign out from the user menu.

#### Scenario: Logout
- **WHEN** the operator selects "Cerrar sesión"
- **THEN** the session is cleared and the user is redirected to `/login`
