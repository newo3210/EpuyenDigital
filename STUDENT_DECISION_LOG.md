# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-10-12
**Change relacionado:** `inspectoria-pet-registry-ux-v2`

---

## 1. Resumen de la decisión

El bot de registro de mascotas de Inspectoría (WhatsApp `+5492944216586`) pasa a **UX v2**: sin paso de consentimiento de privacidad (temporal), sin preguntar barrio, ubicación GPS opcional con ayuda (texto + imagen estática) o “No puedo ahora”, fotos múltiples hasta Listo/texto, antirrábica con “No sé”, y confirmación que nombra al vecino y al animal con ID siempre `EPU-AAAA-#####`.

La arquitectura (webhook delgado → worker → shared state machine → SQL) se mantiene; cambian el guion, contratos y el envío de imagen de ayuda.

## 2. Mapa de flujo de datos

```text
Vecino (WhatsApp)
  → Evolution API
    → POST /api/webhooks/evolution (presentación delgada)
      → verifica secreto + Zod
      → guarda mensaje (idempotente) y encola process_inbound
  → Worker
      → máquina de estados UX v2 (packages/shared)
      → send_outbound texto y, en ayuda de ubicación, mediaPath → sendImage
      → download_media → bucket privado animal-media
      → complete/finalize (p_neighborhood null → EPU) + confirmación con nombre del ciudadano
      → analyze_traits (visión + Zod) sin bloquear el alta
```

- **Sin consentimiento:** `privacy_consent_at` puede quedar null (columna ya nullable).
- **GPS opcional:** lat/lng null en citizen/animal si el vecino salta.
- **Imagen de ayuda:** `LOCATION_HELP_IMAGE_PATH` o `worker/assets/inspectoria/location-help.png` (placeholder hasta arte oficial).

## 3. Justificación de Clean Architecture

- El guion vive en `packages/shared` (pasos + i18n es-AR) para TDD sin I/O.
- Evolution `sendImage` queda en infraestructura; el job solo lleva `mediaPath`.
- Forzar `p_neighborhood = null` en el worker concentra la decisión de producto “siempre EPU” sin reescribir la función SQL que aún entiende barrios a futuro.

## 4. Control de salida (anti-alucinación)

- Visión: schema Zod; reintento; si falla → `pending_manual`.
- Menús cerrados (especie, sexo, tamaño, esterilizado, antirrábica incl. No sé).
- Confirmación interpola solo datos persistidos (`animalName`, `citizenFullName`, `municipalId`).

## 5. Glosario técnico

| Concepto | Qué significa aquí | Dónde aparece en el código |
|---|---|---|
| Welcome | Primer mensaje sin gate de consentimiento | `welcome.intro`, paso `welcome` |
| Location help | Oferta 1/2 + texto + PNG estático | `location_help_offer` / `location_help`, `LOCATION_HELP_IMAGE_PATH` |
| Skip GPS | “No puedo ahora” | `parseLocationSkip`, paso `location` |
| ID EPU | Prefijo municipal fijo en este slice | `formatMunicipalId(null…)`, `p_neighborhood: null` |
| Rabies unknown | Opción “3 No sé” | `RabiesStatus`, migración check SQL |
| Send mode | `dry_run` / `allowlist` / `production` | `worker/src/infrastructure/send-mode.ts` |

## 6. Qué aprendí / qué defendería en una oral

- Por qué sacar el consentimiento ahora: decisión de producto temporal; la columna nullable evita migración destructiva al volver.
- Por qué GPS opcional: baja fricción; el mapa municipal pierde cobertura hasta re-exigirlo.
- Por qué placeholder de imagen: desbloquea el flujo; el runbook exige reemplazo antes de producción ciudadana.
- Por qué siempre EPU: sin índice de barrio no inventamos códigos desde texto libre.

## 7. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| 2026-09-30 | — (bootstrap SDD) | Línea base: flujo planeado, justificación de capas, control de salida, glosario |
| 2026-10-12 | `inspectoria-pet-registry-bot` | Flujo webhook→worker→registro, ID municipal, visión async, send-mode, glosario MVP |
| 2026-10-12 | `inspectoria-pet-registry-ux-v2` | UX v2: sin consent/barrio, GPS opcional + imagen, EPU, rabies unknown, confirmación con nombre |
