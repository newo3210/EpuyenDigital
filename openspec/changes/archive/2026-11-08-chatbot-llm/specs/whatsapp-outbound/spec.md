## ADDED Requirements

### Requirement: Bot outbound uses send_mode
Bot and system WhatsApp texts SHALL use the existing outbound path and `decideSend` (`dry_run` / `allowlist` / `production`). They SHALL persist with `sender_kind` `bot` or `system` as appropriate and SHALL NOT bypass allowlist or dry_run.

#### Scenario: Dry run simulates bot answer
- **WHEN** `send_mode` is `dry_run` and the bot answers
- **THEN** the outbound row is stored as simulated and Evolution is not called
