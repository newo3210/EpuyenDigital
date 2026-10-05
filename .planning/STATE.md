# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 1 — Fundación

## Current Position

Phase: 1 of 7 (Fundación)
Plan: 1 of 2 changes implemented (`foundation-workspace-auth`); next `areas-operators-admin`
Status: Verified + hardened three times — pending re-review of the step-17 diff (separate session), acceptance matrix, human OK, archive
Last activity: 2026-10-05 — second adversarial re-review FAIL (R-1 major: DNI superset broken); step 17 fixes done (tasks 17.1–17.8), re-verified: 365 unit / 127 pgTAP, superset property test 0 leaks, 50-request probe stored exactly 10

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
- [foundation/D12]: Fixes de la re-revisión: alcance blocker + majors + minors baratos; límite de reportes atómico en SQL (columna `origin` + `insert_client_error_report` con advisory lock); redacción como superconjunto de `65eb994`
- [foundation/D13]: Superconjunto estricto (privacidad antes que IPs/decimales intactos), probado con oráculo `65eb994` + test de propiedad; UUID exentos de la redacción numérica; nombres con al menos una letra o número visible
- [foundation/D14]: Fixes de la tercera re-revisión (parcial): la lectura de perfiles nunca rechaza un nombre que la DB aceptó (evita bloquear al operador); el formulario cuenta code points; set de invisibles completo (DB + JS). Estrategia de redacción (S-1/S-2) **bloqueada** hasta decisión del equipo técnico sobre `reports/2026-10-05-redaction-superset-decision-brief.md` (recomendado D+A)

### Pending Todos

- Cerrar `foundation-workspace-auth`: decisión del equipo sobre el brief de redacción → tareas 18.5/18.6 → re-review adversarial del diff `844c553..HEAD` en sesión separada → `acceptance-matrix.md` → OK humano → `/opsx:archive` → merge a `main`
- Proponer `areas-operators-admin` (FND-02..05, FND-06 nivel área) incluyendo Q-3 (protección del último admin activo)
- Backlog de hallazgos diferidos (review 2026-10-05): M-2 (una fila inválida rompe la lista de errores), M-8 (bloqueo de inactivos solo en el layout), M-9 (subidas directas a Storage sin sniffing), M-11 (trace ids son pistas del cliente), M-12 (errores de Auth colapsados en "credenciales incorrectas"), Q-2 (cookies viejas tras sign-out en el layout)
- Backlog de la re-revisión (2026-10-05): N-5 (el corte por longitud puede partir un email o token y dejar ver la mitad), N-6 (formatos de teléfono no cubiertos: pares, `/`, ` - `, pegados a `tel`, `15-xxxxxx`), N-7 (emails muy largos o no ASCII, DSN `scheme://user:pass@host` sin punto, claves `key`/`service_key` en objetos, DNI con separadores inconsistentes), N-10 (resolver del operador sin tests ni timeout; usar `getClaims()` en vez de `getUser()`), N-13 (toda función `security definer` futura que escriba `profiles`/`error_logs` debe re-chequear roles, documentado en `ARCHITECTURE_SDD.md`)
- Backlog de la segunda re-revisión (2026-10-05): R-3 (secretos de más de 4 096 caracteres dejan ver el final; `password=""x` deja ver `x`; única excepción declarada al superconjunto), R-6 (ráfagas en paralelo igual leen y redactan el cuerpo antes del chequeo atómico; limitar pedidos simultáneos por usuario), R-7 (claves de secreto entre comillas simples estilo `util.inspect`, p. ej. `{ 'x-api-key': '…' }`), R-10 (JSON doblemente escapado: la redacción se traga los campos siguientes)
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
- 2026-10-05: re-review adversarial (subagente) FAIL: límite de reportes salteable por truncado (N-1) y por concurrencia (N-2), regresiones de redacción (N-3, N-4). Paso 16 aplicado con TDD (`reports/2026-10-05-step-16-rereview-fixes.md`).
- 2026-10-05: segunda re-review (subagente) FAIL: R-1, DNIs junto a `dígito.` volvían a filtrarse (excepción para IPs/decimales nunca consultada). El usuario eligió superconjunto estricto. Paso 17 aplicado con TDD (`reports/2026-10-05-step-17-rereview-2-fixes.md`).

## Session Continuity

Last session: 2026-10-05
Stopped at: paso 17 completo y documentado; siguiente paso re-review adversarial del diff `4cb9efa..HEAD` en sesión separada, luego acceptance matrix
Resume file: None
