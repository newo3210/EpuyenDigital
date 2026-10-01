# Architecture SDD

> **Language:** English (technical contract).  
> **Location:** repository root `ARCHITECTURE_SDD.md`.  
> Copy this template on first feature; update on every change that alters flow, schemas, routes, or models.

**Last updated:** YYYY-MM-DD  
**Related OpenSpec change:** `openspec/changes/<change-name>/`

---

## 1. System overview

One paragraph: what the system does and the primary user journeys covered by this architecture snapshot.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | e.g. `backend/src/presentation/` or `app/api/` | No business/AI logic |
| Application / services | e.g. `backend/src/application/` or `services/` | Business & AI |
| Infrastructure / repositories | e.g. `backend/src/infrastructure/` or `repositories/` | DB / external I/O |
| Contracts / schemas | e.g. Zod schemas, OpenAPI, domain types | Boundaries only |

## 3. Data & control flow

Describe end-to-end flow for the main feature(s):

```text
Client → Presentation → Application/Service → [LLM / Domain] → Repository → DB
```

Add sequence notes (auth, validation, streaming, error paths).

## 4. API routes

| Method | Path | Auth | Request schema | Response schema | Service |
|---|---|---|---|---|---|
| GET | `/example` | | | | |

## 5. Data schemas & models

### 5.1 Request / response contracts (Zod or equivalent)

Document schema names and fields (or link to source files).

### 5.2 Persistence models

Tables/collections, key relations, indexes relevant to recent changes.

## 6. AI / LLM boundaries (if applicable)

- Provider & model
- Prompt ownership (which service file)
- Output schema (Zod/Pydantic) and validation
- Failure modes: rate-limit, timeout, invalid JSON, streaming abort

## 7. Error handling

How presentation maps domain/application errors to HTTP (or UI) responses. Retry and backoff policy if any.

## 8. Non-goals / out of scope

What this architecture snapshot deliberately does **not** cover.

## 9. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| YYYY-MM-DD | Initial / update summary | `<change-name>` |
