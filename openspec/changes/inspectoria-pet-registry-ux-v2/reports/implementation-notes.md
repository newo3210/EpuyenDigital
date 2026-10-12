# Implementation notes — inspectoria-pet-registry-ux-v2

## Summary

Implemented product UX v2 on branch `cursor/inspectoria-pet-registry-ux-v2-4cd2`:

- Removed consent and neighborhood steps; added welcome + location help offer/help.
- Optional GPS with skip keyword; static help image via `LOCATION_HELP_IMAGE_PATH` / placeholder PNG.
- Rabies `unknown`; health skip `No`; multi-photo finish on any non-image text after ≥1 photo.
- Municipal ID always `EPU-{YYYY}-{SEQ5}` (worker passes null neighborhood).
- Confirmation includes animal name, citizen full name, municipal ID.
- Docs: `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, production smoke runbook, `.env.example`.

## Placeholder asset

`worker/assets/inspectoria/location-help.png` is a minimal valid 1×1 PNG. Replace with official Inspectoría artwork before citizen-facing production (documented in runbook).

## Remaining for real WhatsApp production test

- Apply migration on target Supabase.
- Run Evolution, scan QR for `+5492944216586`, configure webhook + secrets.
- Set `SEND_MODE=allowlist` then `production`; replace help image.
- Live end-to-end conversation (not automated here).
- Adversarial review in a **new** session before `/opsx:archive`.
