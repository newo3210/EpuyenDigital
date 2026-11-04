# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 1.2 — `areas-operators-admin` (next); then `mesa-entrada-inbox`

## Current Position

Phase: 1 of 7 (Fundación) + Phase 2.1 Inspectoría pets on main  
Plan: OpenSpec `reconcile-foundation-to-main` **archived 2026-11-04**  
Status: Foundation + pet registry coexist on mainline (auth, panel shell, webhook). Next: areas + operators admin.  
Last activity: 2026-11-04 — archived reconcile; human OK to merge PR #3 and continue

Progress: [██░░░░░░░░] ~15% (Phase 1 foundation on mainline; areas admin next)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (reconcile-foundation-to-main)
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

### Pending Todos

- Open + implement `areas-operators-admin` (FND-02..05, FND-06 area level) including last-admin protection; seed Mesa de Entrada default + Inspectoría
- Then `mesa-entrada-inbox` (cola real, shared line routing, mapa en tarjeta, coords de consulta)
- Live `supabase db reset` / pgTAP when containers available (residual gap from reconcile)
- Backlogs de redacción/hardening de foundation (B-*, C-*, M-*, N-*, R-*) no bloqueantes
- Opcional: terminar adversarial review de `inspectoria-pet-registry-ux-v2`

### Blockers/Concerns

- Agent env sin Docker/Podman: SQL live proof pendiente en entornos con contenedores
- Preview Vercel del PR #3 falló (check no required); investigar post-merge si afecta deploy

### Process

- 2026-09-30: SDD/OpenSpec instalado. Entrada `/director`.
- 2026-10-05: `foundation-workspace-auth` archived on feature branch (not yet on main then).
- 2026-10-12: Inspectoría pet registry on main.
- 2026-11-04: `reconcile-foundation-to-main` applied, verified, adversarial PASS WITH GAPS, archived; merge PR #3.

## Session Continuity

Last session: 2026-11-04
Stopped at: Archive + merge PR #3; next `/director` change `areas-operators-admin`
Resume file: None
