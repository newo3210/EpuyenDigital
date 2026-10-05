# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 1 — Fundación

## Current Position

Phase: 1 of 7 (Fundación)
Plan: 1 of 2 changes implemented (`foundation-workspace-auth`); next `areas-operators-admin`
Status: Verified + hardened — pending re-review of the fix diff (new chat), acceptance matrix, human OK, archive
Last activity: 2026-10-05 — `/opsx:verify` PASS; adversarial review FAIL (3 majors); step 15 hardening done (tasks 15.1–15.11), re-verified: 306 unit / 89 pgTAP, curl + browser smoke

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
- [foundation/D11]: Hardening post-review: alcance majors + minors baratos; errores del servidor adjuntan org/usuario; signup desactivado (`[auth.email] enable_signup` queda en `true`); protección del último admin diferida a `areas-operators-admin`

### Pending Todos

- Cerrar `foundation-workspace-auth`: re-review adversarial del diff `65eb994..HEAD` en chat nuevo → `acceptance-matrix.md` → OK humano → `/opsx:archive` → merge a `main`
- Proponer `areas-operators-admin` (FND-02..05, FND-06 nivel área) incluyendo Q-3 (protección del último admin activo)
- Backlog de hallazgos diferidos (review 2026-10-05): M-2 (una fila inválida rompe la lista de errores), M-8 (bloqueo de inactivos solo en el layout), M-9 (subidas directas a Storage sin sniffing), M-11 (trace ids son pistas del cliente), M-12 (errores de Auth colapsados en "credenciales incorrectas"), Q-2 (cookies viejas tras sign-out en el layout)
- Antes del deploy: replicar en el proyecto cloud signup off + email provider on + contraseña mínima 10 (README)
- Decisiones del usuario pendientes: Next 16 vs. riesgo de audit de postcss; Node ≥ 24.15; cargar `SUPABASE_CLOUD_SERVICE_ROLE_KEY` antes del deploy; mantener o no un `CHANGELOG.md`

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
- 2026-10-05: `/opsx:verify` PASS; adversarial review FAIL (J-1 login GET, J-2 redacción incompleta/ReDoS, J-3 endpoint de reportes sin límites); paso 15 de hardening aplicado con TDD y re-verificado (`reports/2026-10-05-step-15-hardening.md`). GitHub push protection bloqueó un fixture `sb_secret_`; ahora se arma en runtime.

## Session Continuity

Last session: 2026-10-05
Stopped at: paso 15 completo y documentado; siguiente paso re-review adversarial del diff de fixes en un chat nuevo, luego acceptance matrix
Resume file: None
