# inbox-thread Specification

## Purpose
Thread media, delivery ticks, map links, quick replies, and realtime refresh. Archived from `mesa-entrada-inbox` on 2026-11-08.

## Requirements

### Requirement: Inbound media in the thread
The thread SHALL render stored inbound and outbound messages in time order. Text SHALL show the body. An image or sticker with `storage_path` SHALL show the image via a short-lived signed URL for bucket `whatsapp-media`. Audio SHALL expose a playable control. A document SHALL expose a download link with its file name or mime. When the file cannot be signed, the thread SHALL show the message kind and SHALL NOT break the rest of the thread.

#### Scenario: Image renders
- **WHEN** an operator opens a thread that contains an image message with `storage_path`
- **THEN** the thread shows that image

#### Scenario: Missing file degrades
- **WHEN** a media message has a `storage_path` that cannot be signed
- **THEN** the thread shows the kind label and still shows neighboring text messages

### Requirement: Delivery ticks
Each outbound operator or phone message SHALL show its `delivery_status` as a text label: pending, sent, delivered, read, failed, or blocked. `delivered_at` and `read_at` SHALL be included in the accessible label when present. Inbound messages SHALL NOT show outbound ticks.

#### Scenario: Read status visible
- **WHEN** an outbound message has `delivery_status` `read`
- **THEN** the thread shows a read label on that message

### Requirement: Inquiry map versus home coordinates
Messages with `latitude` and `longitude` SHALL be listed as inquiry locations and SHALL link to OpenStreetMap at that point. When the citizen has `latitude` and `longitude`, the thread SHALL show them once, labeled as home or pet location. The UI SHALL NOT copy inquiry coordinates onto the citizen, and SHALL NOT copy citizen coordinates onto the message. A thread with no coordinates SHALL omit the map block.

#### Scenario: Both coordinate kinds visible
- **WHEN** a message has inquiry coordinates and the citizen has different home coordinates
- **THEN** the thread shows both points with different labels and both values stay on their original rows

#### Scenario: No coordinates
- **WHEN** the thread has no message coordinates and the citizen has null latitude
- **THEN** no map or coordinate block is shown

### Requirement: Quick replies
An admin SHALL create, edit, and deactivate quick replies with shortcut, title, and body. `area_id` null means all areas; otherwise the reply belongs to one area. An operator composing on a conversation SHALL list active replies whose area is null or equals the conversation area, and inserting one SHALL put its body into the composer without sending. Support SHALL NOT manage quick replies.

#### Scenario: Area-scoped reply hidden
- **WHEN** an operator composes on a Mesa de Entrada conversation
- **THEN** they see active org-wide replies and Mesa replies, and they do not see an active Inspectoría-only reply

#### Scenario: Insert does not send
- **WHEN** the operator inserts a quick reply
- **THEN** the composer contains that body and no outbound message is created until they submit

### Requirement: Realtime thread and queue
While the inbox is open, inserts or updates to visible conversations and their messages SHALL update the open thread and the queue without a full browser reload. A new inbound message on the open thread SHALL appear in the thread. A claim by someone else SHALL update the owner shown on the card. The subscription SHALL only apply rows the operator is allowed to read.

#### Scenario: Open thread receives a message
- **WHEN** a citizen message is inserted on the conversation the operator is viewing
- **THEN** the message appears in the thread without a browser reload

#### Scenario: Queue shows a new claim
- **WHEN** another operator claims a visible unowned conversation
- **THEN** the queue card shows the new owner without a browser reload
