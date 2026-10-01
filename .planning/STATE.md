# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 1 — Fundación

## Current Position

Phase: 1 of 7 (Fundación)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-09-30 — Proyecto reiniciado como nuevo; documentación de diseño creada (PROJECT, REQUIREMENTS, ROADMAP, docs/)

Progress: [░░░░░░░░░░] 0%

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

### Pending Todos

None yet.

### Blockers/Concerns

- Repo dentro de OneDrive (`...\cursor\Epuyen Bot`), riesgo aceptado por el usuario: vigilar sincronización de `node_modules` y volúmenes de Podman
- Modo local: Docker no instalado; se usa Podman 5.8 (máquina WSL corriendo). Falta validar Supabase CLI local sobre Podman (fallback: proyecto Supabase cloud solo para desarrollo)
- Proveedor LLM y hosting sin definir (Phase 6 / Phase 7)
- Repo de referencia clonado solo lectura en `%TEMP%\seguros-review` (temporal)

### Process

- 2026-09-30: SDD/OpenSpec instalado (copy-fallback desde OpenSpecs-Template). Cada fase del roadmap se entrega con cambios en `openspec/changes/`; entrada `/director`.
- 2026-10-01: repo remoto `github.com/newo3210/EpuyenDigital` (rama `main`); identidad git local configurada.
- 2026-10-01: cambio `foundation-workspace-auth` (Phase 1, 1 de 2) planificado y aprobado; Tailwind v4.

## Session Continuity

Last session: 2026-10-01
Stopped at: Plan de `foundation-workspace-auth` aprobado; siguiente paso implementación en `feature/foundation-workspace-auth`
Resume file: None
