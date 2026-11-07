## ADDED Requirements

### Requirement: Unowned-first FIFO queue
Operators SHALL see open conversations for their accessible areas with unowned conversations first ordered by `entered_queue_at` ascending (FIFO), then owned conversations by `last_inbound_at` descending. Within groups, `needs_response` and critical SLA SHALL sort higher.

#### Scenario: Two unowned conversations order
- **WHEN** two unowned conversations exist with different `entered_queue_at`
- **THEN** the older `entered_queue_at` appears above the newer one

### Requirement: Queue card flags
Each queue card SHALL show last message time, registered/unregistered citizen flag, owner, area, pending delegation, needs response, SLA status (ok/warning/critical), bot active/paused, and has-attachments when applicable.

#### Scenario: Card shows needs response and area
- **WHEN** a conversation’s last message is inbound and unowned in Mesa de Entrada
- **THEN** the card shows needs-response and the Mesa de Entrada area name

### Requirement: Queue filters
Operators SHALL filter the queue by area, line, owner, awaiting my acceptance, needs response, and has attachments.

#### Scenario: Filter awaiting my acceptance
- **WHEN** an operator filters “esperando mi aceptación” and has a pending user delegation
- **THEN** only conversations awaiting that operator’s acceptance are listed
