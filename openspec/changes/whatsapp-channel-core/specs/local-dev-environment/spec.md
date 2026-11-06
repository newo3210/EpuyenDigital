## ADDED Requirements

### Requirement: Line secrets and Evolution env documented
`.env.example` and local-dev docs SHALL list variables needed for Evolution base URL, instance, webhook secret, and service-role paths used by line admin and outbound, without committing real secrets. Seed SHALL remain runnable in `dry_run` without a live Evolution instance.

#### Scenario: dry_run local seed
- **WHEN** a developer resets and seeds the local database with documented defaults
- **THEN** the Inspectoría line exists with Mesa de Entrada as default area and send_mode `dry_run` so outbound tests do not require Evolution
