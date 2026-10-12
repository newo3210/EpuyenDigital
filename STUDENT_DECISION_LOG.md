# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-10-12
**Change relacionado:** `inspectoria-pet-registry-bot`

---

## 1. Resumen de la decisión

Entregamos un MVP vertical del bot de registro de mascotas por WhatsApp para la Inspectoría (línea `+5492944216586`), sin esperar el panel completo de Mesa de Entrada. El vecino acepta el aviso de privacidad (Ley 25.326), carga sus datos y la ubicación, describe al animal (perro/gato/otro), manda fotos y recibe un identificador municipal al instante. Las características visuales las completa un LLM de visión en segundo plano.

Arrancamos el monorepo (`apps/web`, `worker`, `packages/shared`, `supabase`) para que Mesa de Entrada reutilice las mismas carpetas después.

## 2. Mapa de flujo de datos

```text
Vecino (WhatsApp)
  → Evolution API
    → POST /api/webhooks/evolution (presentación delgada)
      → verifica secreto + Zod
      → guarda mensaje (idempotente) y encola process_inbound
  → Worker
      → máquina de estados (packages/shared)
      → download_media → bucket privado animal-media
      → send_outbound (dry_run / allowlist / production)
      → complete_animal_registration (SQL) → ID municipal
      → analyze_traits (visión + Zod) sin bloquear el alta
```

- **Webhook → store**: JSON de Evolution normalizado; secreto obligatorio; grupos ignorados.
- **Worker → shared**: la lógica pura de pasos vive en `packages/shared` (testeable sin I/O).
- **Worker → SQL**: el ID municipal y el contador se asignan en una función atómica.
- **Worker → LLM**: solo fotos; respuesta JSON estricta; si falla, `pending_manual`.

## 3. Justificación de Clean Architecture

- El webhook no llama al LLM ni descarga media: Evolution reintenta si tarda, y no queremos respuestas duplicadas.
- La máquina de estados es pura en `packages/shared` para TDD rápido y para reutilizar parsers de botones/números.
- `complete_animal_registration` está en SQL porque el contador anual necesita `FOR UPDATE` contra carreras.
- El modo de envío (`dry_run` por defecto) permite probar en local sin spamear WhatsApp real.

## 4. Control de salida (anti-alucinación)

- Visión: schema Zod `visionTraitsSchema`; reintento único; si sigue mal → `traits_status = pending_manual` y el animal sigue `active` con su ID.
- No hay chatbot libre: solo prompts de registro con menús cerrados (especie, sexo, tamaño, etc.).
- Logs pasan por redacción de teléfono y DNI.

## 5. Glosario técnico

| Concepto | Qué significa aquí | Dónde aparece en el código |
|---|---|---|
| Webhook delgado | Solo secreto + Zod + persistir + encolar | `apps/web/src/app/api/webhooks/evolution` |
| Sesión de registro | Paso actual + payload JSON con TTL 24h | `registration_sessions`, `packages/shared/.../state-machine.ts` |
| ID municipal | `{BARRIO3}-{YYYY}-{SEQ5}` o `EPU-…` | `complete_animal_registration`, `formatMunicipalId` |
| Send mode | `dry_run` / `allowlist` / `production` | `worker/src/infrastructure/send-mode.ts` |
| VisionClient | Adaptador de visión agnóstico al proveedor | `worker/src/infrastructure/llm/vision-client.ts` |

## 6. Qué aprendí / qué defendería en una oral

- Por qué el MVP es standalone: valor para Inspectoría sin esperar auth/panel.
- Por qué especie no va en el ID: evita colisiones con códigos de barrio; la especie vive en la fila.
- Por qué `dry_run` es el default: seguridad en local y en CI.
- Por qué foundation-workspace-auth no es dependencia: el producto pidió vertical-only; al integrar hay que unificar el scaffold con cuidado.

## 7. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| 2026-09-30 | — (bootstrap SDD) | Línea base: flujo planeado, justificación de capas, control de salida, glosario |
| 2026-10-12 | `inspectoria-pet-registry-bot` | Flujo webhook→worker→registro, ID municipal, visión async, send-mode, glosario MVP |
