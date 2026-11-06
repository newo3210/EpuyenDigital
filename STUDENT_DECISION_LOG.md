# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-11-06  
**Change relacionado:** `areas-operators-admin`

---

## 1. Resumen de la decisión

Se implementan las **áreas municipales** y la **administración de operadores** (FND-02..05 y el nivel área de FND-06) sobre la base ya unificada de fundación + registro de mascotas. Mesa de Entrada queda como área por defecto e Inspectoría como vertical; la cola real de mensajería sigue diferida a `mesa-entrada-inbox`.

Decisiones de diseño de este change (D1–D8):

| Id | Decisión | Por qué |
|---|---|---|
| D1 | Contraseña temporal mostrada una sola vez (sin email de invitación) | Evita SMTP/plantillas fuera de alcance |
| D2 | Solo `admin` escribe áreas y operadores | Coincide con la matriz de `docs/data-model.md` |
| D3 | Protección del último admin activo en la DB | La UI no puede dejar la org sin admin |
| D4 | Email replicado en `profiles`; no se cambia el email después del alta en v1 | Listado sin Auth Admin en cada carga; evita drift |
| D5 | Solo columnas SLA (sin motor) | Preparar inbox sin inventar vencimientos |
| D6 | Un solo default con índice parcial + trigger de swap | Transacción segura al promover otra área |
| D7 | Alta: Auth admin → profile → membresías; compensación si falla | Evita usuarios Auth huérfanos |
| D8 | Nav `/settings/areas` y `/settings/operators` solo admin | Perfil sigue disponible para todos |

## 2. Mapa de flujo de datos

### 2.1 Alta de operador

```text
Admin → /settings/operators → createOperatorAction
  → Auth Admin createUser (service role)
  → insert profiles (email, rol, org)
  → replace area_members (RLS del admin)
  → si falla después de Auth: deleteUser
  → UI muestra contraseña temporal una vez
```

### 2.2 Áreas y helper de acceso

```text
Admin → /settings/areas → create/update (RLS admin)
Seed → Mesa de Entrada (is_default) + Inspectoría
current_area_ids() → ids de membresía del operador activo
  (inbox aplicará este helper a conversaciones/tareas después)
```

### 2.3 Panel e Inspectoría (sin cambio de comportamiento)

```text
Login → sesión → panel shell
WhatsApp → webhook Evolution → worker registro de mascotas
```

## 3. Justificación de Clean Architecture

- Contratos Zod en `contracts/areas` y `contracts/operators`.
- Casos de uso en `features/areas` y `features/operators` (compensación Auth, last-admin a nivel app).
- Repositorios y Auth admin en `infrastructure/`; la DB sigue siendo autoridad (RLS, triggers).
- Presentación delgada: formularios solo validan y llaman server actions.

## 4. Control de salida

- Errores de dominio mapeados a mensajes es-AR (duplicado, último admin, fallo de alta).
- Sin LLM en este change.
- Email post-alta rechazado en el caso de uso de update (mitigación D4).

## 5. Glosario técnico

| Concepto | Qué significa aquí | Dónde aparece |
|---|---|---|
| Área por defecto | Exactamente una por org (`is_default`) | trigger `areas_guard_default` |
| `current_area_ids()` | Membresías del operador activo | migración areas-operators-admin |
| Last-admin | No dejar cero admins activos | trigger + mensajes de UI |
| Compensación Auth | Borrar usuario Auth si falla el profile | `create-operator.ts` |
| Contraseña temporal | Visible una vez al admin; sin invite mail | UI operadores |

## 6. Qué aprendí / qué defendería en una oral

- Por qué el default se limpia en un trigger y no solo en la UI: el índice único parcial no tolera dos `true`, y hay que impedir quedarse en cero.
- Por qué createUser va con service role y las membresías con el cliente del admin: `authenticated` no tiene INSERT en `profiles` (decisión de fundación).
- Por qué inbox no usa todavía `current_area_ids()`: el change declara el helper; aplicar RLS a conversaciones es el epic siguiente.

## 7. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| 2026-09-30 | — (bootstrap SDD) | Línea base |
| 2026-10-01 / 05 | `foundation-workspace-auth` | Login, RLS, redacción, Podman, archivo |
| 2026-10-12 | `inspectoria-pet-registry-bot` / `ux-v2` | Flujo mascotas UX v2 |
| 2026-11-04 | `reconcile-foundation-to-main` | Baseline integrado, superset orgs, follow-ups Mesa |
| 2026-11-06 | `areas-operators-admin` | Áreas, operadores, D1–D8, `current_area_ids()` |
