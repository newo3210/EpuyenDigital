# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Foundation reconciled into mainline; next `areas-operators-admin`, then `mesa-entrada-inbox`

## Current Position

Phase: 1 of 7 (Fundación) + Phase 2.1 Inspectoría pets already on main  
Plan: OpenSpec `reconcile-foundation-to-main` (apply in progress)  
Status: Foundation (`foundation-workspace-auth`, archived 2026-10-05) merging onto main with pet registry; organizations schema superset; panel shell + webhook coexist  
Last activity: 2026-11-04 — reconcile foundation into mainline branch

Progress: [██░░░░░░░░] ~15% (Phase 1 foundation on mainline; areas admin next)

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
- [2026-10-12]: MVP Inspectoría suelto (no espera panel Mesa de Entrada); caballo en pausa; registro automático; GPS vía ubicación nativa WhatsApp; ID `{BARRIO3}-{YYYY}-{SEQ5}` → UX v2 fuerza prefijo `EPU`
- [foundation]: Supabase local sobre Podman; cloud solo para `db push`/deploy; 403 con `forbidden()`; redacción con contrato explícito (D14–D17)
- [2026-11-04 reconcile]: Merge `feature/foundation-workspace-auth` → branch basada en main; `organizations` superset + migración forward-only; misma línea WA documentada; dual coords (pet vs inquiry) diferido; inbox real diferido

### Pending Todos

- Completar verify + acceptance matrix + adversarial review de `reconcile-foundation-to-main` (director)
- Proponer `areas-operators-admin` (FND-02..05, FND-06 nivel área) incluyendo protección del último admin
- Luego `mesa-entrada-inbox` (cola real, shared line routing, mapa en tarjeta, coords de consulta)
- Backlogs de redacción/hardening de foundation (B-*, C-*, M-*, N-*, R-*) siguen no bloqueantes
- Opcional: terminar adversarial review de `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Repo dentro de OneDrive en máquinas Windows: vigilar sync de `node_modules` y volúmenes Podman
- Proveedor LLM y hosting sin definir (Phase 6 / Phase 7)

### Process

- 2026-09-30: SDD/OpenSpec instalado. Entrada `/director`.
- 2026-10-05: `foundation-workspace-auth` archivado en feature branch (specs en `openspec/specs/`).
- 2026-10-12: Inspectoría pet registry + UX v2 en `main`.
- 2026-11-04: `reconcile-foundation-to-main` planificado y en apply.

## Session Continuity

Last session: 2026-11-04  
Stopped at: implementer apply of reconcile-foundation-to-main  
Resume file: None
