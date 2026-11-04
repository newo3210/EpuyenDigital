# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-11-04  
**Change relacionado:** `areas-operators-admin`

---

## 1. Resumen de la decisión

Con la fundación y el bot de mascotas ya en `main`, este cambio agrega las **áreas municipales** y la **administración de operadores** (FND-02..06 a nivel área) sin inventar todavía la bandeja real.

- Mesa de Entrada es el área `is_default` (hub); Inspectoría es el vertical de ejemplo.
- Solo `admin` crea/edita áreas y operadores; el último admin activo no se puede desactivar ni degradar (`last_admin` en SQL).
- El email del operador no se replica en `profiles`: se lee de Auth al listar (Admin API).
- `operator_area_ids()` queda listo para que el inbox futuro filtre conversaciones por área.

## 2. Mapa de flujo de datos

### 2.1 Panel (fundación + admin)

```text
Operador → /login → sesión Supabase Auth → middleware refresca cookies
  → /inbox (placeholder) / perfil / soporte de errores
Admin → /settings/areas | /settings/operators
  → server actions con requireRole('admin')
  → áreas vía RLS; default vía RPC set_default_area
  → alta operador: service role createUser + profile + area_members
  → baja lógica: is_active=false + deactivated_at (trigger); login sigue bloqueado
```

### 2.2 Inspectoría (mascotas)

```text
Vecino (WhatsApp) → Evolution → POST /api/webhooks/evolution
  → secreto de línea → persistir mensaje → encolar process_inbound
Worker → máquina de estados UX v2 → alta animal (ID EPU) → visión async
Línea Inspectoria.default_area_id → área Inspectoría (seed)
```

### 2.3 Esquema de áreas

`areas` + `area_members`; índice único parcial de un solo `is_default` por org; `profiles.deactivated_at`; FK `whatsapp_lines.default_area_id`.

## 3. Justificación de Clean Architecture

- Contratos Zod en `contracts/admin-*` y entidad `area` en shared.
- Casos de uso en `features/admin/*` (testeables sin Next); acciones solo cablean puertos.
- Persistencia en `infrastructure/repositories/{areas,area-members,operators}.ts`.
- Invariantes fuertes (último admin, un solo default) viven en Postgres, no en la UI.

## 4. Control de salida

- Contraseña temporaria: se muestra una sola vez en la UI; no se loguea.
- Errores `last_admin` / email duplicado mapeados a mensajes es-AR.
- Roles creatables en UI v1: `admin` | `area_lead` | `operator` (`support` queda fuera del formulario).

## 5. Glosario técnico

| Concepto | Qué significa aquí | Dónde aparece |
|---|---|---|
| Mesa de Entrada | Área default / hub de triage | seed + `is_default` |
| `operator_area_ids()` | Set de áreas del caller | migración áreas; futuro RLS inbox |
| `last_admin` | No dejar la org sin admin activo | trigger + map-admin-error |
| `deactivated_at` | Marca temporal de baja lógica | trigger sync + listado |
| `set_default_area` | RPC que limpia el default previo | SQL + settings áreas |

## 6. Qué aprendí / qué defendería en una oral

- Por qué el default se cambia con RPC y no con un UPDATE directo: el índice único parcial exige limpiar el anterior en la misma operación confiable.
- Por qué `last_admin` es trigger y no solo chequeo en la app: cualquier cliente con JWT de admin quedaría cubierto.
- Por qué no hay tabla `conversations` acá: el alcance OpenSpec lo prohíbe; el helper evita rediseñar membresías después.

## 7. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| 2026-09-30 | — (bootstrap SDD) | Línea base |
| 2026-10-01 / 05 | `foundation-workspace-auth` | Login, RLS, redacción, Podman, archivo |
| 2026-10-12 | `inspectoria-pet-registry-bot` / `ux-v2` | Flujo mascotas UX v2 |
| 2026-11-04 | `reconcile-foundation-to-main` | Baseline integrado, superset orgs, follow-ups Mesa |
| 2026-11-04 | `areas-operators-admin` | Áreas, operadores admin, last_admin, seed Mesa+Inspectoría |
