# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 3 prep — `mesa-entrada-inbox` (next)

## Current Position

Phase: 1 of 7 (Fundación) largely complete + Phase 2.1 Inspectoría pets on main  
Plan: OpenSpec `areas-operators-admin` **archived 2026-11-06**  
Status: Areas + operators admin on delivery branch / merging to main; live db reset / E2E still env-blocked without Docker.  
Last activity: 2026-11-06 — human OK archive + merge PR #5

Progress: [███░░░░░░░] ~25% (foundation + areas/operators admin archived)

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (reconcile-foundation-to-main, areas-operators-admin)
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
- [2026-11-06 areas]: Temp password once (D1); admin-only writes (D2); last-admin DB trigger + advisory lock (D3); email on profiles, immutable after create v1 (D4); SLA columns only (D5); single default + `pg_trigger_depth` swap (D6); Auth compensation surfaced (D7); admin nav (D8); memberships via RPC

### Pending Todos

- Open + implement `mesa-entrada-inbox` (cola real, shared line routing, mapa en tarjeta, coords de consulta, RLS con `current_area_ids()`)
- Live `supabase db reset` / pgTAP / curl / E2E when containers available (residual gap from areas-operators-admin)
- Backlogs de redacción/hardening de foundation (B-*, C-*, M-*, N-*, R-*) no bloqueantes
- Opcional: terminar adversarial review de `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Agent env sin Docker/Podman: SQL live proof, curl contra stack y E2E browser pendientes
- Preview Vercel checks may fail (often not required); investigate if deploy is affected

### Process

- 2026-09-30: SDD/OpenSpec instalado. Entrada `/director`.
- 2026-10-05: `foundation-workspace-auth` archived on feature branch (not yet on main then).
- 2026-10-12: Inspectoría pet registry on main.
- 2026-11-04: `reconcile-foundation-to-main` applied, verified, adversarial PASS WITH GAPS, archived; merge PR #3.
- 2026-11-06: `areas-operators-admin` applied, adversarial PASS WITH GAPS after fix loop, archived; human OK merge PR #5.

## Session Continuity

Last session: 2026-11-06
Stopped at: Archive + merge PR #5; next `/director` change `mesa-entrada-inbox`
Resume file: None
