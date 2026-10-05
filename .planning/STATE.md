# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 1 — Fundación

## Current Position

Phase: 1 of 7 (Fundación)
Plan: 1 of 2 changes implemented (`foundation-workspace-auth`); next `areas-operators-admin`
Status: Implemented — pending `/opsx:verify`, adversarial review (new chat), acceptance matrix, human OK, archive
Last activity: 2026-10-01 — `foundation-workspace-auth` tasks 0–14 done: monorepo, Supabase local on Podman, org RLS, auth/guards, profile, error tracking + support screen, E2E evidence, docs

Progress: [█░░░░░░░░░] ~7% (Phase 1: 1 of 2 changes)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Arrancar limpio, documentación primero; portar desde `newo3210/seguros` pieza por pieza
- [Init]: Evolution API único transporte v1; tabla única `citizens`; áreas como entidad de primera clase
- [Init]: Bot pausado por conversación con dueño humano (corrige bug del CRM)
- [foundation]: Supabase local sobre Podman como entorno principal (spike PASS); cloud solo para `db push`/deploy
- [foundation]: 403 con `forbidden()` vía `experimental.authInterrupts` (aprobado por el usuario)
- [foundation]: Errores correlacionados por `details.digestRef` (hash solo letras) porque la redacción enmascaraba el digest numérico

### Pending Todos

- Cerrar `foundation-workspace-auth`: `/opsx:verify` → adversarial review en chat nuevo → `acceptance-matrix.md` → OK humano → `/opsx:archive` → merge a `main`
- Proponer `areas-operators-admin` (FND-02..05, FND-06 nivel área)
- Decisiones del usuario pendientes: Next 16 vs. riesgo de audit de postcss; Node ≥ 24.15; desactivar signup de Supabase; cargar `SUPABASE_CLOUD_SERVICE_ROLE_KEY` antes del deploy

### Blockers/Concerns

- Repo dentro de OneDrive (`...\cursor\Epuyen Bot`), riesgo aceptado por el usuario: vigilar sincronización de `node_modules` y volúmenes de Podman
- Modo local: Docker no instalado; se usa Podman 5.8 (máquina WSL, 2 GiB). Supabase CLI local validado sobre Podman (spike 2026-09-30); vigilar memoria si se suman servicios
- Proveedor LLM y hosting sin definir (Phase 6 / Phase 7)
- Repo de referencia clonado solo lectura en `%TEMP%\seguros-review` (temporal)

### Process

- 2026-09-30: SDD/OpenSpec instalado (copy-fallback desde OpenSpecs-Template). Cada fase del roadmap se entrega con cambios en `openspec/changes/`; entrada `/director`.
- 2026-10-01: repo remoto `github.com/newo3210/EpuyenDigital` (rama `main`); identidad git local configurada.
- 2026-10-01: cambio `foundation-workspace-auth` (Phase 1, 1 de 2) planificado y aprobado; Tailwind v4.
- 2026-10-01: `foundation-workspace-auth` implementado en `feature/foundation-workspace-auth` (248 tests unitarios, 69 pgTAP, curl y E2E en `openspec/changes/foundation-workspace-auth/reports/`).

## Session Continuity

Last session: 2026-10-01
Stopped at: `foundation-workspace-auth` implementado y documentado; siguiente paso `/opsx:verify` y adversarial review en un chat nuevo
Resume file: None
