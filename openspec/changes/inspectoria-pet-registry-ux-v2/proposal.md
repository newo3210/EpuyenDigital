## Why

Product owner replaced the archived pet-registry conversation script with municipal Inspectoría copy: simpler citizen steps, assisted optional GPS (with a static help image), no privacy consent for now, no barrio question (ID prefix `EPU`), multi-photo finish with Listo/text, and a confirmation that names the citizen.

Roadmap: **Phase 2.1 follow-up (UX v2)** · Touches **INSP-PET-02..06** (delta behavior/copy).

## What Changes

- Rewrite es-AR registration copy and step order in `packages/shared` state machine + i18n.
- Remove consent and neighborhood steps from the happy path.
- Add location-help branch (`1 Sí` / `2 No…`) that sends fixed help text + static image via outbound media.
- Allow skipping GPS with `No puedo ahora`; citizen/animal may have null coordinates.
- Rabies menu adds `3 No sé`; health-card skip keyword `No` (replacing `saltar`).
- Photo step: accumulate images; complete on Listo/OK/non-image text after ≥1 photo.
- Confirmation: thanks + animal registered under citizen full name + municipal ID (`EPU-YYYY-SEQ5`).
- Update main/delta specs, root docs, and tests.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `pet-registration-conversation`: new script, optional location, no consent/barrio, multi-photo finish rule, help image.
- `animal-registry`: GPS no longer mandatory; rabies may be `unknown`; ID prefix always `EPU` in this MVP slice; confirmation includes citizen name.

## Impact

- Code: `packages/shared` (i18n, menus, steps, state machine), `worker` (outbound image for help, finalize payload), asset under `worker/assets/` or `apps/web/public/inspectoria/`.
- Specs: delta under this change; sync on archive.
- Planning: note INSP-PET-02 deferred (consent), INSP-PET-04 softened (GPS optional).
