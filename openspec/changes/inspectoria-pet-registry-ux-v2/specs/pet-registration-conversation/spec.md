## REMOVED Requirements

### Requirement: Privacy consent before personal data
Temporarily removed from MVP conversation per product decision (2026-10-12). May return later.

## MODIFIED Requirements

### Requirement: Guided citizen then animal order
Registration SHALL collect citizen data first (without consent or neighborhood), then animal data.

#### Scenario: Order enforced for new citizen
- **WHEN** a new phone starts registration
- **THEN** steps run in order: welcome → full name → document → address → location help offer → location (or skip) → animal fields → photos → thanks/confirmation

### Requirement: Citizen fields collected via chat
The bot SHALL collect full name, DNI/passport, and address line as text. Neighborhood SHALL NOT be requested in this version.

#### Scenario: Valid citizen data
- **WHEN** the citizen provides valid name, document, and address
- **THEN** the session stores the values and offers location help (`1 Sí` / `2 No, ya sé cómo hacerlo`)

### Requirement: Native location with help and skip
The bot SHALL offer help for sharing WhatsApp location, send a static help image when the citizen chooses help, accept a location pin, and allow skipping with an explicit “No puedo ahora” (or equivalent) to continue without GPS.

#### Scenario: Declines help
- **WHEN** the citizen answers `2` / already knows how
- **THEN** the bot asks them to share current location (with skip option)

#### Scenario: Accepts help
- **WHEN** the citizen answers `1` / Sí
- **THEN** the bot sends help text and the configured static help image, then asks for location

#### Scenario: Location shared
- **WHEN** the citizen sends a WhatsApp location pin
- **THEN** coordinates are stored and the conversation advances to animal name

#### Scenario: Skip location
- **WHEN** the citizen sends `No puedo ahora` (or configured skip keyword) at the location step
- **THEN** registration continues without latitude/longitude

### Requirement: Animal fields with interactive buttons
Species, sex, size, sterilized use the same catalogs as before; rabies adds **No sé**.

#### Scenario: Rabies status
- **WHEN** the bot asks for antirrábica status
- **THEN** options are `1 Al día`, `2 Pendiente`, `3 No sé`

#### Scenario: Health card optional
- **WHEN** the bot offers a health booklet photo
- **THEN** the citizen may send an image or reply `No` to skip

### Requirement: Freeform animal photos
The bot SHALL accept one or more freeform animal photos and SHALL complete only after ≥1 photo when the citizen sends Listo/OK or other non-image text.

#### Scenario: Multiple photos then finish
- **WHEN** the citizen sends two images then `Listo`
- **THEN** both photos are linked and registration completes

#### Scenario: Finish without photos blocked
- **WHEN** the citizen tries to finish with zero animal photos
- **THEN** the bot requires at least one photo

### Requirement: Automatic registration and WhatsApp confirmation
On completion the bot SHALL thank the citizen and confirm with animal name, citizen full name, and municipal ID.

#### Scenario: Completion copy
- **WHEN** registration completes for animal A and citizen C with id M
- **THEN** the outbound message includes A, C’s full name, and M

## ADDED Requirements

### Requirement: Welcome without consent gate
The first bot message SHALL introduce Inspectoría pet registration and state that citizen data comes first, without requiring an accept/decline privacy choice.

#### Scenario: First message
- **WHEN** a new phone starts a session
- **THEN** the bot sends the welcome copy and asks for full name next (after welcome or as the following prompt)
