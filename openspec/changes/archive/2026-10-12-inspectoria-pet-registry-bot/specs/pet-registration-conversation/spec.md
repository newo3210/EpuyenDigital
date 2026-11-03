## ADDED Requirements

### Requirement: Privacy consent before personal data
The bot SHALL show a privacy / consent notice (Ley 25.326) and SHALL NOT collect name, document, address, or location until the citizen explicitly accepts.

#### Scenario: Accept consent
- **WHEN** a new session starts and the citizen replies accepting the notice
- **THEN** the session moves to citizen data collection and `privacy_consent_at` is set

#### Scenario: Decline or unclear
- **WHEN** the citizen declines or the reply is not an acceptance
- **THEN** the bot explains that registration cannot continue without consent and does not store personal profile fields

### Requirement: Guided citizen then animal order
Registration SHALL collect citizen data first, then animal data; the bot SHALL not ask for animal fields before citizen minimums (including GPS) are complete for a new citizen.

#### Scenario: Order enforced for new citizen
- **WHEN** a new phone starts registration
- **THEN** steps run in order: consent → full name → document → address → neighborhood → location → animal fields → photos → confirmation

### Requirement: Returning citizen friendly greeting
If the inbound phone already belongs to a registered citizen, the bot SHALL greet them by name and offer to register another animal or confirm citizen data (MVP: confirm is explicit OK only; free-text profile corrections are out of scope).

#### Scenario: Known phone
- **WHEN** a registered citizen messages the line
- **THEN** the bot greets them using their stored full name in es-AR and offers to register a new animal

#### Scenario: Confirm citizen data with OK
- **WHEN** a returning citizen chooses confirm data and replies `OK` (or equivalent confirm keyword)
- **THEN** the session advances to animal registration without changing stored citizen fields

#### Scenario: Non-OK text at confirm does not advance
- **WHEN** a returning citizen is on the confirm step and sends free-text that is not an explicit OK/confirm
- **THEN** the bot re-prompts for OK and does not advance

#### Scenario: Unknown phone
- **WHEN** the phone is not in the registry
- **THEN** the bot starts the full citizen registration after consent

### Requirement: Citizen fields collected via chat
The bot SHALL collect full name, DNI/passport, address line, and barrio/paraje as text, validating non-empty trimmed values and a document pattern before advancing.

#### Scenario: Valid citizen data
- **WHEN** the citizen provides valid name, document, address, and neighborhood
- **THEN** the session stores the values and asks for WhatsApp location share

#### Scenario: Invalid document
- **WHEN** the document is empty or fails the DNI/passport pattern
- **THEN** the bot re-prompts for the document without advancing

### Requirement: Animal fields with interactive buttons
For species, sex, size, sterilized, and rabies status the bot SHALL present WhatsApp interactive buttons (or equivalent quick-reply controls supported by Evolution) with the catalog values below; breed/color, name, age/stage, and microchip use text.

#### Scenario: Species selection
- **WHEN** the bot asks for species
- **THEN** options are exactly Perro, Gato, Otro (horse not offered)

#### Scenario: Sex selection
- **WHEN** the bot asks for sex
- **THEN** options are Macho and Hembra

#### Scenario: Size selection
- **WHEN** the bot asks for size
- **THEN** options are Pequeño, Mediano, Grande

#### Scenario: Sterilized selection
- **WHEN** the bot asks if sterilized/castrated
- **THEN** options are Sí, No, No sé

#### Scenario: Rabies status
- **WHEN** the bot asks for antirrábica status
- **THEN** options are Al día and Pendiente, and the bot offers an optional photo of the health booklet

### Requirement: Freeform animal photos
The bot SHALL accept one or more freeform animal photos from the camera or gallery (no mandatory angles) and SHALL require at least one before completing registration.

#### Scenario: First photo accepted
- **WHEN** the citizen sends an image at the photo step
- **THEN** the bot acknowledges and asks whether to add another photo or finish

#### Scenario: Finish without photos blocked
- **WHEN** the citizen tries to finish with zero animal photos
- **THEN** the bot requires at least one photo

### Requirement: Automatic registration and WhatsApp confirmation
On successful completion the system SHALL activate the animal record immediately (no human approval) and SHALL send a WhatsApp confirmation message including the municipal animal ID and a short summary. No PDF or QR is required.

#### Scenario: Completion
- **WHEN** all required citizen and animal steps succeed
- **THEN** the animal is stored as active, a municipal ID is assigned, and the citizen receives a confirmation message containing that ID

### Requirement: Session resume and expiry
In-progress registration sessions SHALL resume on the next message from the same phone on the same line until TTL expiry; after expiry the bot SHALL start a fresh flow.

#### Scenario: Resume mid-flow
- **WHEN** the citizen continues after a pause within TTL
- **THEN** the bot continues at the pending step

#### Scenario: Expired session
- **WHEN** the citizen messages after TTL expiry with an incomplete session
- **THEN** the bot starts a new registration flow and does not reuse stale partial animal data

### Requirement: Horse and livestock out of MVP
The conversation SHALL NOT offer horse or livestock plantel registration in this MVP.

#### Scenario: No horse button
- **WHEN** species options are shown
- **THEN** Caballo and plantel species are absent
