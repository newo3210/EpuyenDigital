# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-11-04  
**Change relacionado:** `reconcile-foundation-to-main`

---

## 1. Resumen de la decisión

Se unifica en una sola línea de entrega lo que estaba separado: el **panel con autenticación de operadores** (rama `feature/foundation-workspace-auth`, archivado 2026-10-05) y el **bot de registro de mascotas de Inspectoría** ya en `main`. Sin inventar aún la bandeja real de Mesa de Entrada.

Decisiones de producto que este merge solo documenta (siguen diferidas):

- Misma línea WhatsApp (`+5492944216586`) para Mesa e Inspectoría hasta que exista una segunda.
- Coordenadas de **consulta** (Mesa) distintas de GPS de **mascota** (`citizens.latitude/longitude`); el mapa en la tarjeta del ciudadano va en el change de inbox.
- Siguiente epic: `areas-operators-admin`, después `mesa-entrada-inbox`.

## 2. Mapa de flujo de datos

### 2.1 Panel (fundación)

```text
Operador → /login → sesión Supabase Auth → middleware refresca cookies
  → /inbox (placeholder) / perfil / soporte de errores
Errores de UI → redacción en shared → error_logs (service role / RPC acotado)
```

### 2.2 Inspectoría (mascotas)

```text
Vecino (WhatsApp) → Evolution → POST /api/webhooks/evolution
  → secreto de línea → persistir mensaje → encolar process_inbound
Worker → máquina de estados UX v2 → alta animal (ID EPU) → visión async
```

### 2.3 Esquema compartido

`organizations` queda como **superset**: columnas de fundación + `timezone` y `updated_at` de pets, más `org_settings` y tablas de mascotas, más `profiles` / `error_logs`. Si el reset fresco creaba orgs “angostas”, una migración forward-only `20261104*_reconcile_*` agrega columnas con `IF NOT EXISTS` (no reescribimos migraciones ya publicadas en `main`).

## 3. Justificación de Clean Architecture

- Auth/perfil/errores viven en `features/*` + infraestructura Supabase; el webhook sigue delgado.
- El dominio de registro sigue en `packages/shared` y el worker; no se mete lógica de mascotas en el layout del panel.
- OpenSpec: capacidades de fundación restauradas en `openspec/specs/`; el change activo viejo apunta al archivo `2026-10-05-foundation-workspace-auth`.

## 4. Control de salida

- Errores del panel: contrato de redacción explícito (fundación).
- Bot: menús cerrados + visión con Zod; confirmación solo con datos persistidos.
- No se reutilizan lat/lng de mascota para el mapa de consultas de Mesa (evita mezclar semánticas).

## 5. Glosario técnico

| Concepto | Qué significa aquí | Dónde aparece |
|---|---|---|
| Superset orgs | Una sola tabla `organizations` con columnas de ambos mundos | migración reconcile + types |
| Panel shell | Rutas `/inbox` etc. sin cola real | `(panel)/*` |
| Shared WA line | Un solo número Evolution por ahora | `.env.example`, design D6 |
| Dual coords | GPS mascota ≠ pin de consulta Mesa | design D5; follow-up inbox |
| Webhook host | API Evolution sigue en `/api/webhooks/evolution` | `apps/web` + worker |

## 6. Qué aprendí / qué defendería en una oral

- Por qué merge + migración forward-only y no reescribir pets: `main` ya publicó esas migraciones; alterar historia rompe entornos aplicados.
- Por qué `/` redirige al panel y no al placeholder del webhook: el producto es el panel; el webhook es API.
- Por qué no “terminar” el inbox en este PR: el alcance OpenSpec prohíbe fingir triage; desbloquea el siguiente epic con base coherente.

## 7. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| 2026-09-30 | — (bootstrap SDD) | Línea base |
| 2026-10-01 / 05 | `foundation-workspace-auth` | Login, RLS, redacción, Podman, archivo |
| 2026-10-12 | `inspectoria-pet-registry-bot` / `ux-v2` | Flujo mascotas UX v2 |
| 2026-11-04 | `reconcile-foundation-to-main` | Baseline integrado, superset orgs, follow-ups Mesa |
