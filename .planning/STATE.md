# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 1.2 — `areas-operators-admin` (apply complete on branch; verify/adversarial/archive next); then `mesa-entrada-inbox`

## Current Position

Phase: 1 of 7 (Fundación) + Phase 2.1 Inspectoría pets on main  
Plan: OpenSpec `areas-operators-admin` **implemented 2026-11-06** (branch `cursor/areas-operators-admin-0e30`)  
Status: Areas + operators admin code + migration + seed + Vitest on branch. Live db reset / E2E blocked without Docker.  
Last activity: 2026-11-06 — implementer finished tasks 1–5; section 6 director-owned

Progress: [███░░░░░░░] ~20% (foundation + areas/operators admin on feature branch)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (reconcile-foundation-to-main); areas-operators-admin apply in progress toward archive
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
- [2026-11-04 reconcile]: Merge foundation → main; organizations superset; seed SQL+TS coexistence; idempotent foundation DDL; same WA line documented; dual coords deferred; inbox real deferred
- [2026-11-06 areas]: Temp password once (D1); admin-only writes (D2); last-admin DB trigger (D3); email on profiles, immutable after create v1 (D4); SLA columns only (D5); single default partial unique + trigger (D6); Auth compensation (D7); admin nav (D8)

### Pending Todos

- Director: `/opsx:verify`, acceptance-matrix, adversarial-review, human OK, archive, PR to `main`
- Then `mesa-entrada-inbox` (cola real, shared line routing, mapa en tarjeta, coords de consulta, RLS con `current_area_ids()`)
- Live `supabase db reset` / pgTAP / curl / E2E when containers available
- Backlogs de redacción/hardening de foundation (B-*, C-*, M-*, N-*, R-*) no bloqueantes
- Opcional: terminar adversarial review de `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Agent env sin Docker/Podman: SQL live proof, curl contra stack y E2E browser pendientes
- Preview Vercel del PR #3 falló (check no required); investigar post-merge si afecta deploy

### Process

- 2026-09-30: SDD/OpenSpec instalado. Entrada `/director`.
- 2026-10-05: `foundation-workspace-auth` archived on feature branch (not yet on main then).
- 2026-10-12: Inspectoría pet registry on main.
- 2026-11-04: `reconcile-foundation-to-main` applied, verified, adversarial PASS WITH GAPS, archived; merge PR #3.
- 2026-11-06: `areas-operators-admin` applied (tasks 1–5); section 6 left to director.

## Session Continuity

Last session: 2026-11-06
Stopped at: Implementer handoff after tasks 1–5; reports under `openspec/changes/areas-operators-admin/reports/`
Resume file: None
