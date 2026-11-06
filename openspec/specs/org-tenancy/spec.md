# org-tenancy Specification

## Purpose
Organizations, operator profiles and roles, and row-level isolation between organizations. Introduced by change `foundation-workspace-auth` (archived 2026-10-05).

## Requirements

### Requirement: Organizations and profiles
The system SHALL store organizations and operator profiles, where each profile belongs to exactly one organization and has a role (`admin`, `area_lead`, `operator`, `support`) and an active flag.

#### Scenario: Profile linked to auth user
- **WHEN** an admin profile is seeded
- **THEN** the profile id equals the Supabase Auth user id, `org_id` references the seeded organization, `role` is `admin`, and `is_active` is true

### Requirement: RLS helper functions
The database SHALL expose `current_org_id()` and `current_user_role()` (not `current_role()`, which collides with the reserved SQL keyword `CURRENT_ROLE`) returning the caller's organization and role, and returning null when the caller has no profile or the profile is inactive.

#### Scenario: Active operator
- **WHEN** an authenticated active operator calls `current_org_id()`
- **THEN** it returns the operator's organization id

#### Scenario: Inactive operator
- **WHEN** an authenticated operator whose profile has `is_active = false` calls `current_org_id()`
- **THEN** it returns null

### Requirement: Cross-organization isolation
Row Level Security SHALL be enabled on every business table including `areas` and `area_members`, and no operator SHALL read or modify rows of another organization. Area and membership writes SHALL additionally require role `admin` of the caller's organization (except service role / seed).

#### Scenario: Read isolation
- **WHEN** an operator of organization A selects from `profiles`
- **THEN** only profiles of organization A are returned

#### Scenario: Write isolation
- **WHEN** an operator of organization A attempts to update a profile of organization B
- **THEN** zero rows are affected

#### Scenario: Inactive operator sees nothing
- **WHEN** an inactive operator selects from any business table
- **THEN** zero rows are returned

#### Scenario: Read isolation for areas
- **WHEN** an operator of organization A selects from `areas`
- **THEN** only areas of organization A are returned

#### Scenario: Write isolation for area_members
- **WHEN** an admin of organization A attempts to insert a membership for a profile of organization B
- **THEN** zero rows are inserted

### Requirement: Profile self-service limits
An operator SHALL be able to update only their own `full_name` and `avatar_path`; `role`, `org_id`, and `is_active` SHALL be changeable only by an admin of the same organization; `id` and `created_at` SHALL be changeable by no client. The database SHALL enforce `full_name` as 2–80 characters (code points) after trimming invisible characters (spaces, tabs, newlines, NBSP, zero-width and bidi marks, soft hyphen, Hangul fillers, braille blank, variation selectors including the supplement, Mongolian free variation selectors, Khmer inherent vowels, reserved specials U+FFF0–U+FFF8, shorthand and musical format controls, tag characters), and SHALL require at least one letter or decimal digit once those characters are removed; the database SHALL also keep the raw `full_name` within 2–80 code points; the profile form SHALL apply the same rules, counting code points. Unassigned default-ignorable code points (U+2065, U+E0080–U+E00FF, U+E01F0–U+E0FFF) are not stripped (out of scope). Reading a profile SHALL never fail for a name the database accepted. The database SHALL also enforce `avatar_path` as null or a path under `{org_id}/{id}/` of the same profile.

#### Scenario: Operator tries to escalate role
- **WHEN** an operator updates their own profile setting `role = 'admin'`
- **THEN** the update is rejected and the role remains unchanged

#### Scenario: Admin tries to re-key a profile
- **WHEN** an admin updates a profile setting `id` to another auth user id
- **THEN** the update is rejected

#### Scenario: Foreign avatar path or blank name
- **WHEN** an operator updates their own profile through the REST API with another user's avatar path or a name of only spaces, tabs, NBSP, or zero-width characters
- **THEN** the update is rejected

#### Scenario: Visually blank name
- **WHEN** an operator sets a name made only of Hangul fillers, LRM/RLM marks, soft hyphens, or combining marks
- **THEN** the update is rejected, while names such as `José Pérez`, `李明` or `Ana María` are accepted

#### Scenario: Name with emoji or astral letters
- **WHEN** an operator saves `Ana` followed by 40 emoji, or 41 mathematical bold letters, through the REST API (accepted by the database: at most 80 code points)
- **THEN** their profile still loads and the panel keeps working

### Requirement: Least-privilege table grants
The `authenticated` role SHALL hold no `INSERT`, `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`, or `MAINTAIN` privilege on `organizations`, `profiles`, or `error_logs`; writes it needs are limited to the `UPDATE` paths governed by RLS.

#### Scenario: Truncate attempt
- **WHEN** an authenticated operator runs `truncate public.error_logs`
- **THEN** it fails with a permission error

### Requirement: Area membership helper
The database SHALL expose `current_area_ids()` returning the set of `area_id` values for the caller's active profile memberships in their organization, and returning an empty set when the caller has no profile, is inactive, or has no memberships.

#### Scenario: Member of two areas
- **WHEN** an active operator belongs to Mesa de Entrada and Inspectoría
- **THEN** `current_area_ids()` returns both area ids

#### Scenario: Inactive operator
- **WHEN** an inactive operator calls `current_area_ids()`
- **THEN** it returns an empty set

### Requirement: Profile email and deactivation timestamp
`profiles` SHALL store a replicated `email` (unique per organization when present) for directory listing and a nullable `deactivated_at` timestamptz set when `is_active` becomes false and cleared when reactivated. Clients SHALL NOT escalate privileges by writing `email` outside admin provisioning paths enforced by the database or service-role admin APIs.

#### Scenario: Email visible on profile row
- **WHEN** an admin creates an operator with email `op@epuyen.gob.ar`
- **THEN** `profiles.email` equals that address for directory queries

#### Scenario: Deactivation stamps time
- **WHEN** an admin deactivates an operator
- **THEN** `deactivated_at` is non-null
