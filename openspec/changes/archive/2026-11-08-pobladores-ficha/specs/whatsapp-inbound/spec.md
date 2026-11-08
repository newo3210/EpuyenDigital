## MODIFIED Requirements

### Requirement: Citizen stub on first contact
A new phone SHALL create or link an unregistered citizen with phone and available WhatsApp profile fields (POB-01 subset needed for channel). The stub SHALL write `whatsapp_push_name` and SHALL NOT assign that value to `full_name`. A later inbound SHALL NOT change a profile column whose `field_sources` entry is `manual`. Full ficha editing is specified in `citizen-profile`.

#### Scenario: New phone creates unregistered citizen
- **WHEN** an unknown normalized phone messages the line
- **THEN** an unregistered citizen and citizen_phones row exist linked to the conversation

#### Scenario: Repeat inbound keeps a manual name
- **WHEN** a known citizen with a manual `full_name` sends another message that includes a different pushName
- **THEN** `whatsapp_push_name` may update and `full_name` is unchanged
