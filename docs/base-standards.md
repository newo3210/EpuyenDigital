---
description: Development rules and guidelines for the Epuyén municipal WhatsApp messaging panel, applicable to all AI agents (Cursor, Claude, Codex, Gemini, etc.).
alwaysApply: true
---

# Base Standards — Mesa de Entrada Digital Epuyén

## 1. Core Principles

- **Small tasks, one at a time**: Work in baby steps. Never advance more than one step without verification.
- **Test-Driven Development**: Start with failing tests for any new functionality (TDD), as described in each OpenSpec `tasks.md`.
- **Type Safety**: All code is TypeScript `strict`. No `any` without a written justification in the same line.
- **Clear Naming**: Descriptive names for variables, functions, files, SQL objects.
- **Incremental Changes**: Prefer focused changes over large modifications.
- **Question Assumptions**: Always question assumptions and inferences; ask when scope is ambiguous.
- **Pattern Detection**: Detect and highlight repeated code patterns; extract to `packages/shared` when reused by web and worker.
- **Database owns state transitions**: Conversation and task state changes run inside atomic SQL functions (expected state + `FOR UPDATE` + history row in the same transaction). Application code never writes state columns directly.
- **Append-only history**: Event, history, and activity tables accept inserts only (enforced by RLS and triggers).
- **Privacy by design**: Citizen personal data (DNI, address, documents, phone) is visible only by role/area, redacted in logs, and stored in private buckets with short-lived signed URLs (Ley 25.326).

## 2. Language Standards

- **English only** for all technical artifacts: code, comments, error codes, log messages, SQL objects, schemas, config, scripts, commit messages, test names, OpenSpec artifacts, `ARCHITECTURE_SDD.md`.
- **Spanish (es-AR)** for:
  - User-facing UI copy and chatbot messages (centralized in the i18n module, never hard-coded in components).
  - `STUDENT_DECISION_LOG.md` (pedagogical log).
  - Chat with the user when the user writes in Spanish.
  - Planning docs already written in Spanish (`.planning/*`, `docs/architecture.md`, `docs/data-model.md`, `docs/flows.md`, `docs/reuse-from-seguros.md`) may stay in Spanish.

## 3. Specific Standards

- [Backend Standards](./backend-standards.md) — Supabase/Postgres, SQL functions, RLS, webhook, worker, Evolution API, LLM services, testing.
- [Frontend Standards](./frontend-standards.md) — Next.js App Router, components, server actions, realtime, UI/UX, accessibility.
- [Documentation Standards](./documentation-standards.md) — documentation structure and maintenance.
- [OpenSpec Tasks Mandatory Steps](./openspec-tasks-mandatory-steps.md) — required checklist for every `tasks.md`.
- Product design references: [architecture.md](./architecture.md), [data-model.md](./data-model.md), [flows.md](./flows.md), [reuse-from-seguros.md](./reuse-from-seguros.md).

## 4. Project Skills

- Canonical skills live in `ai-specs/skills/`; agent role prompts in `ai-specs/agents/`.
- When a request matches a skill, load and follow its `SKILL.md` (and referenced files) before continuing.

## 5. Planning Model Requirement

Planning workflows (`enrich-us`, OpenSpec `ff` / `continue`, adversarial review) should run on a high-reasoning model. If the current session is not, say so to the user before starting; do not edit editor settings silently.

## 6. Skill Mirrors (copy-fallback mode)

- `ai-specs/` is the canonical source. `.cursor/skills/*` and `.cursor/agents/project-director.md` are **physical copies** (Windows symlinks unavailable at bootstrap, 2026-09-30).
- When a canonical skill changes, re-sync the mirror (skill `sync-agent-symlinks`) in the same change. A change is incomplete if mirrors are stale.

## 7. Mandatory OpenSpec Artifact Updates for Post-Apply Changes

When a fix or change request appears after apply and before archive, treat it as a spec update first:

1. Update affected artifacts (scenarios, requirements, `tasks.md`) in the proper section — not as ad-hoc "bugfix" tasks.
2. Regenerate artifacts if needed (`/opsx:continue`, `/opsx:ff`).
3. Implement only after artifacts reflect the request.
4. Re-run verification before archive.

## 8. Project Director Entry Point

- **Default orchestration**: `/director` (command) + skill `project-director` for new features, scope changes, or unclear requests.
- **Human checkpoints**: plan approval after `ff`, post-verify review, explicit OK before archive.
- **Independent review**: adversarial review runs as a separate subagent/session from apply.
- **Assisted OpenSpec**: no global `openspec` CLI. Agents read/write `openspec/changes/` and `openspec/specs/` directly, following `.cursor/skills/openspec-*` and `project-director`.
- **Archive gate**: no archive without updated root `ARCHITECTURE_SDD.md` and `STUDENT_DECISION_LOG.md` (§10).

## 9. Clean Architecture — Layer Mapping (this project)

Each OpenSpec change declares its concrete paths in `design.md`. Default mapping:

| Conceptual layer | Responsibility | Paths in this repo |
|---|---|---|
| **Presentation / HTTP thin** | Receive request, validate with Zod, call services. No business or AI logic. | `apps/web/src/app/**` (pages, layouts, route handlers incl. `api/webhooks/evolution`), `apps/web/src/presentation/**` (React components), server action entry files |
| **Application / services** | Business rules, orchestration, AI (LLM, RAG, classification, extraction). | `apps/web/src/features/<feature>/**`, `worker/src/features/**`, `worker/src/jobs/**`, `packages/shared/src/**` (pure domain logic: phones, SLA, queue ordering, prompts) |
| **Infrastructure / repositories** | Persistence and external I/O only. | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**` (Supabase clients, Evolution client, storage, crypto, LLM provider adapters), `supabase/migrations/**` |
| **Contracts / schemas** | Zod schemas and TypeScript types at API, webhook, job, and LLM boundaries. | `apps/web/src/contracts/**`, `packages/shared/src/contracts/**`, generated `database.types.ts` |

**Deliberate deviation**: atomic state transitions (claim, delegate, accept, reject, resolve, task lifecycle, citizen merge) live in SQL functions under `supabase/migrations/`. Services call them through repositories; they are the transaction boundary, not ad-hoc business logic scattered in SQL.

### 9.1 Output control & errors

- Every LLM output is parsed with a strict Zod schema; invalid output → retry once, then handoff to a human with reason `error`.
- Webhook payloads, job payloads, and server action inputs are Zod-validated at the boundary.
- Model failures, rate limits, and timeouts are handled in services and mapped to typed error codes; presentation maps codes to es-AR messages.

### 9.2 Frontend note

Components render and collect input; they call server actions or thin client services. No LLM prompts, RAG, Evolution calls, or service-role DB access in components.

### 9.3 Source file section comments

In hand-written `.ts`/`.tsx`/`.js`/`.jsx`: blank line between logical sections and a one-line comment above each section in the format `// <What this block is> - <What it does>` (props/params groups, schemas, state groups, function blocks, returned API, non-trivial JSX regions). Apply to new files and touched blocks only.

## 10. Mandatory Root Documentation Artifacts

Every time a feature, route, or module is built, updated, or finalized, update at repo root:

- **`ARCHITECTURE_SDD.md` (English)** — system flow, layer mapping, routes, schemas, AI boundaries, error handling. Template: `ai-specs/skills/project-director/references/architecture-sdd-template.md`.
- **`STUDENT_DECISION_LOG.md` (Spanish)** — data-flow map, Clean Architecture justification, output control, glossary. Template: `ai-specs/skills/project-director/references/student-decision-log-template.md`.

| Phase | Requirement |
|---|---|
| Plan | `design.md` states layer mapping + schema contracts; `tasks.md` includes tasks to update both root docs |
| Apply | Implementer updates both root docs when the slice lands |
| Verify / adversarial | Missing or stale docs → CRITICAL / Major |
| Archive | Hard gate: no archive if either file is missing, empty, or stale for the change |

## 11. Planning Hierarchy (GSD roadmap + OpenSpec changes)

- **Macro**: `.planning/` (GSD) holds the product vision (`PROJECT.md`), requirement IDs (`REQUIREMENTS.md`), and the 7-phase `ROADMAP.md`. It answers *what* and *in which order*.
- **Micro**: each roadmap phase is delivered through one or more OpenSpec changes in `openspec/changes/<name>/`. They answer *exactly how*, with testable scenarios.
- Every OpenSpec `proposal.md` references the roadmap phase and requirement IDs it covers (e.g. `Phase 1 — FND-01, FND-02`).
- On archive, update `.planning/REQUIREMENTS.md` traceability and `.planning/STATE.md`.

## 12. Local Development Environment (current mode)

The project runs **local-only** until a hosting decision is made (see `docs/architecture.md` §7).

| Piece | Local setup |
|---|---|
| Node | v24 (engines `>=20`), npm workspaces |
| Containers | **Podman** (`podman machine` on WSL) — Docker is not installed. Use `podman compose` for Evolution. |
| Supabase | Local stack via `npx supabase` CLI on Podman (`DOCKER_HOST` → Podman socket). **Fallback** if the CLI does not run on Podman: a dedicated Supabase cloud project for development only (never production data). |
| Evolution API | `infra/evolution/docker-compose.yml` on Podman; webhook to the host dev server via `http://host.containers.internal:3000/api/webhooks/evolution`. Linking still requires a real WhatsApp number (test SIM). |
| Send mode | `dry_run` by default locally; `allowlist` with team phones for real tests. |
| Secrets | `.env.local` files, never committed; `.env.example` documents every variable. |

## 13. Git

- Conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`), English.
- One feature branch per OpenSpec change: `feature/<change-name>`.
- Remote: `origin` → `https://github.com/newo3210/EpuyenDigital.git`. Default branch `main`.
- Feature branches merge into `main` via pull request after verify + adversarial review + human OK.
- Repository-local git identity is configured (GitHub noreply email); never commit secrets or `.env.local`.
