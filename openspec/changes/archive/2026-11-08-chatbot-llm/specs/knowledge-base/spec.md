## ADDED Requirements

### Requirement: Admin manages knowledge documents
An admin SHALL upload or register official documents (PDF, text, FAQ) for the organization, set optional `area_id` and `valid_until`, activate or deactivate them, and trigger reindex. Support and operators SHALL NOT mutate the knowledge base. Support MAY read document metadata.

#### Scenario: Admin uploads and indexes
- **WHEN** an admin uploads an active PDF and reindex completes
- **THEN** `knowledge_chunks` exist for that document and `index_status` is ready

#### Scenario: Operator cannot upload
- **WHEN** an operator calls the knowledge upsert RPC
- **THEN** the call is rejected with `FORBIDDEN`

### Requirement: Retrieval uses only active in-date chunks
RAG retrieval SHALL consider only chunks whose document is `is_active`, not past `valid_until`, and belongs to the caller's organization. Optional area filter MAY narrow results but SHALL NOT return another organization's chunks.

#### Scenario: Expired document excluded
- **WHEN** a document's `valid_until` is in the past
- **THEN** its chunks are not returned by retrieval
