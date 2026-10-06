# operator-profile Specification

## Purpose
The signed-in operator profile: display name and avatar. Introduced by change `foundation-workspace-auth` (archived 2026-10-05).

## Requirements

### Requirement: Edit display name
An operator SHALL be able to edit their own display name from "Configuración → Perfil".

#### Scenario: Valid name
- **WHEN** the operator saves a name between 2 and 80 characters
- **THEN** the profile is updated and the top bar shows the new name without a full reload

#### Scenario: Invalid name
- **WHEN** the operator saves an empty or 1-character name
- **THEN** a validation error is shown and the profile is unchanged

### Requirement: Upload avatar
An operator SHALL be able to upload their own avatar (JPEG, PNG, or WebP, max 2 MB), stored under `avatars/{org_id}/{user_id}/`.

#### Scenario: Valid image
- **WHEN** the operator uploads a 500 KB PNG
- **THEN** the avatar is stored, `avatar_path` is updated, and the new avatar appears in the top bar

#### Scenario: Invalid file
- **WHEN** the operator uploads a 3 MB image or a PDF
- **THEN** the upload is rejected with "La imagen debe ser JPG, PNG o WebP de hasta 2 MB." and nothing is stored

#### Scenario: Writing another user's folder
- **WHEN** a request tries to write to `avatars/{org_id}/{other_user_id}/`
- **THEN** the storage policy rejects it

#### Scenario: Deleting another user's avatar
- **WHEN** an operator deletes an object under another user's or another organization's avatar folder
- **THEN** zero objects are deleted

#### Scenario: Listing other organizations' avatars
- **WHEN** an operator lists objects of the `avatars` bucket
- **THEN** only objects under their own organization's folder are returned (public image URLs keep working)

### Requirement: Default avatar
Operators without an avatar SHALL be shown initials derived from their display name.

#### Scenario: No avatar
- **WHEN** an operator named "Ana Pérez" has no avatar
- **THEN** the UI shows "AP"
