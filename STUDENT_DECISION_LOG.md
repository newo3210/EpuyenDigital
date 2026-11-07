# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-11-07  
**Change relacionado:** `mesa-entrada-inbox`

---

## 1. Resumen de la decisión

Se implementa el **panel de triage de Mesa de Entrada** (INB-01..15): cola FIFO sin dueño primero, claim/delegación con aceptación, eventos, leído/no leído, respuestas rápidas, SLA por área y horario hábil, mapa de consulta (coords distintas del GPS de mascotas), realtime con badge/sonido opcional, y RLS por `current_area_ids()`.

Decisiones de diseño (D1–D6 del `design.md`):

| Id | Decisión | Por qué |
|---|---|---|
| D1 | Transiciones en SQL con `FOR UPDATE` | Una sola fuente de verdad; `CLAIM_CONFLICT` ante carreras |
| D2 | Realtime vía Supabase postgres_changes | Actualiza cola/hilo sin recargar; badge local |
| D3 | Dual coords (mensaje + denorm en conversación) | No pisar `citizens.lat/lng` de Inspectoría |
| D4 | `set_conversation_area` + gate opcional de pet | Línea compartida: Mesa deriva a mano; pet solo si área Inspectoría o hay sesión |
| D5 | SLA con `business_hours` o calendario | Configurable por área; vacío → minutos de reloj |
| D6 | Quick replies con seed municipal | Operadores usan plantillas sin admin CRUD completo |

## 2. Mapa de flujo de datos

### 2.1 Cola y claim

```text
Operador → /inbox (FIFO unowned-first)
  → claim_conversation / ensure_owner_for_reply al enviar
  → bot_state = paused + evento CLAIMED
  → delegar a usuario o área → accept/reject
```

### 2.2 Reopen y pet gate

```text
Vecino escribe sobre resuelta → reopen_conversation → cola new
Inbound en instancia/línea Inspectoría (p. ej. seed `inspectoria`) → process_inbound aunque el área default sea Mesa
Inbound área Inspectoría o con sesión abierta → process_inbound
Inbound en línea solo-Mesa sin sesión → no encola process_inbound (triage)
```

### 2.3 Composer

```text
Composer → ensure_owner_for_reply → send_mode → Evolution / dry_run
Hilo muestra ticks de delivery_status (sent/delivered/read)
```

## 3. Justificación de arquitectura limpia

- Las reglas de ownership viven en Postgres (RPCs), no en componentes React.
- `features/inbox` traduce errores RPC a copy es-AR; la UI solo dispara actions.
- Repositorios leen bajo RLS; el webhook usa service role + `reopen_conversation`.

## 4. Control de salida / secretos

- Sin cambios al cifrado de secretos de línea.
- El mapa usa OpenStreetMap embed/link público con lat/lng de consulta (no datos de mascota).

## 5. Glosario breve

| Término | Significado |
|---|---|
| Claim | Tomar una conversación sin dueño |
| Soft handoff | Delegar con aceptación (usuario o área) |
| Dual coords | Pin de consulta ≠ GPS de mascota en `citizens` |
| SLA crítico | Esperó más que `sla_critical_minutes` del área (horario hábil) |
