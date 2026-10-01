# Flujos — Mesa de Entrada Digital Epuyén

> Estado: diseño inicial (2026-09-30). Nombres de tablas y enums según [data-model.md](data-model.md).

## 1. Mensaje entrante (de punta a punta)

```mermaid
sequenceDiagram
  participant V as Vecino
  participant E as Evolution API
  participant W as Webhook (panel)
  participant DB as Postgres
  participant J as Worker
  participant O as Operador (panel)

  V->>E: Mensaje (texto / foto / audio / PDF)
  E->>W: POST messages.upsert + secreto
  W->>W: Valida secreto de la linea (obligatorio)
  W->>W: Normaliza (ignora grupos, resuelve @lid, detecta fromMe)
  W->>DB: Upsert poblador por telefono (no registrado si es nuevo)
  W->>DB: Upsert conversacion + insert mensaje (idempotente por external_id)
  W->>DB: Si estaba resuelta: reopen_conversation
  W->>DB: Encola jobs (media.download si hay adjunto, bot.reply)
  W-->>E: 200 OK
  DB-->>O: Realtime: aparece en la cola
  J->>DB: Toma media.download
  J->>E: Descarga adjunto
  J->>DB: Guarda en Storage, media_status = stored
  J->>DB: Encola media.transcribe / media.read segun tipo
  J->>DB: Toma bot.reply (ver seccion 2)
```

Reglas:
- `fromMe` (escrito desde el teléfono de la línea) se guarda como saliente con `sender_kind = phone`; no dispara bot.
- `messages.update` actualiza `delivery_status` (entregado / leído).
- El poblador nuevo se crea con `registration_status = unregistered`, `whatsapp_push_name` y teléfono en `citizen_phones`.
- `needs_response = true` y `last_inbound_at = now()` en cada mensaje del vecino.

## 2. Decisión del bot

```mermaid
flowchart TD
  start[Job bot.reply] --> g1{Bot pausado global?}
  g1 -- si --> q[Asegurar que la conversacion este en cola - silencioso]
  g1 -- no --> g2{Conversacion con dueno humano o bot_state paused?}
  g2 -- si --> silent[No responder - decision silent]
  g2 -- no --> g3{Primer contacto?}
  g3 -- si --> priv[Enviar aviso de privacidad]
  g3 -- no --> g4
  priv --> g4{Fuera de horario?}
  g4 -- si --> ooh[Mensaje de horarios + handoff out_of_hours]
  g4 -- no --> g5{Pide hablar con una persona o tema sensible?}
  g5 -- si --> ho[Handoff con motivo]
  g5 -- no --> rag[RAG: buscar en base de conocimiento]
  rag --> g6{Confianza suficiente?}
  g6 -- si --> ans[Responder citando fuente + envio de archivo si corresponde]
  g6 -- no --> g7{Se puede aclarar con una pregunta?}
  g7 -- si --> clar[Pregunta de aclaracion - maximo 1 vez]
  g7 -- no --> ho
  ho --> queue[bot_state = handoff, cola del area sugerida, evento QUEUED]
```

Siempre, en paralelo a la respuesta:
- **Clasificación**: `topic`, `urgency`, `suggested_area_id` en `bot_runs` y en la conversación.
- **Extracción de datos**: si detecta nombre/DNI/domicilio, pregunta "¿Confirmás que tu DNI es 12.345.678?" y recién con el "sí" llama a `upsert_citizen_field(..., source = 'bot')`.
- **Registro**: toda decisión queda en `bot_runs` (fuentes, confianza, motivo) y es visible para el operador.

Handoff: el acuse al vecino ("Tu consulta fue derivada a [Área]. Te responde una persona a la brevedad.") se envía **una sola vez** por episodio de cola, no en cada mensaje (bug del CRM).

## 3. Estados de la conversación

Dos ejes independientes: **columna de la cola** (`queue_column`) y **estado del bot** (`bot_state`).

```mermaid
stateDiagram-v2
  [*] --> BotActivo: primer mensaje
  BotActivo --> New: handoff del bot
  New --> Claimed: claim o responder
  Claimed --> InProgress: mover
  Claimed --> WaitingExternal: mover
  InProgress --> WaitingExternal: mover
  WaitingExternal --> InProgress: mover
  Claimed --> Resolved: resolver
  InProgress --> Resolved: resolver
  WaitingExternal --> Resolved: resolver
  Resolved --> New: el vecino vuelve a escribir (reopen)
  Resolved --> BotActivo: bot reactivado al resolver
```

Reglas de `bot_state`:
- `active` → el bot atiende.
- `handoff` → pasó a cola; el bot calla.
- `paused` → hay dueño humano; el bot calla. Se pone al hacer claim y vuelve a `active` al resolver.
- Al reabrir (vecino escribe sobre resuelta): si el bot está activo globalmente, `bot_state = active` y el bot decide; si deriva, vuelve a `new`.

Orden de la cola (INB-01): primero sin dueño por `entered_queue_at` ascendente (FIFO), luego con dueño por `last_inbound_at` descendente. Dentro de cada grupo, `needs_response` y SLA crítico suben.

## 4. Claim y delegación con aceptación (soft handoff)

```mermaid
sequenceDiagram
  participant A as Operador A
  participant DB as Postgres
  participant B as Operador B / Area X

  A->>DB: claim_conversation
  DB-->>A: ok (owner = A, bot_state = paused, evento CLAIMED)
  A->>DB: delegate_conversation(destino, nota)
  DB-->>B: awaiting_acceptance = true, evento DELEGATED
  alt B acepta (boton o respondiendo)
    B->>DB: accept_conversation_delegation
    DB-->>B: owner = B, evento ACCEPTED
  else B rechaza con motivo
    B->>DB: reject_conversation_delegation(nota)
    DB-->>A: owner = A de nuevo, evento REJECTED
  end
```

Detalles:
- **Delegar a usuario**: `owner_user_id = destino`, `delegated_from_user_id = A`, `awaiting_acceptance = true`. Mientras espera, A sigue viendo la conversación.
- **Delegar a área**: `pending_area_id = X`, `owner_user_id = null`, `awaiting_acceptance = true`; aparece en la cola del área X como "delegada, esperando que alguien la tome". Quien la toma primero la acepta (claim = accept). Si un `area_lead` de X la rechaza, vuelve a A.
- **Responder = tomar/aceptar** (`ensure_owner_for_reply`): sin dueño → claim; delegación pendiente propia → accept; dueño otro → bloquea con "Esta conversación la tiene [nombre]".
- Conflictos de concurrencia: `FOR UPDATE` + estado esperado → error `CLAIM_CONFLICT` legible.

## 5. Ciclo de vida de una tarea

```mermaid
stateDiagram-v2
  [*] --> Pending: create_task
  Pending --> InProgress: claim / accept / start
  Pending --> Cancelled: cancel con motivo
  InProgress --> Done: complete con outcome
  InProgress --> Cancelled: cancel con motivo
  InProgress --> Failed: no se pudo cumplir
  Pending --> Done: complete con outcome
  Done --> Pending: reopen
  Cancelled --> Pending: reopen
  Pending --> Cancelled: abandon_stale_tasks (outcome abandoned)
  InProgress --> Cancelled: abandon_stale_tasks (outcome abandoned)
```

- **Audiencias**: `self` (queda en curso para mí), `area` (bolsa del área; cualquiera la toma), `user` (delegada con aceptación), `external` (contacto externo por WhatsApp, sección 6).
- **Cierre**: `complete_task(outcome)` exige `outcome` y guarda `completed_by`. "Quién la resolvió" = `completed_by` (o `external_contact_id` si cerró un externo).
- **Abandono automático**: pg_cron diario ejecuta `abandon_stale_tasks()` → tareas abiertas con `last_activity_at` más viejo que `task_abandon_days` pasan a `cancelled` con `outcome = abandoned`, evento `ABANDONED`, actor `system`, nota sellada.
- **Aviso al vecino**: si `notify_citizen_on_close`, al cerrar con `resolved` se encola un mensaje al vecino por la conversación de origen.
- Toda transición escribe `task_history` y actualiza `last_activity_at` en la misma transacción.

## 6. Delegación a un contacto externo por WhatsApp

Para responsables de área que no usan el panel (ej. encargado de un corralón o delegado de un paraje).

```mermaid
sequenceDiagram
  participant O as Operador
  participant DB as Postgres
  participant J as Worker
  participant X as Contacto externo (WhatsApp)

  O->>DB: delegate_task(audience = external, contacto)
  DB->>J: job external.notify
  J->>X: "Tarea T-0123 - Reclamo: luminaria calle X. Responde ACEPTO T-0123 o RECHAZO T-0123 motivo"
  X->>J: ACEPTO T-0123
  J->>DB: accept_task (actor external), evento EXTERNAL_REPLIED + ACCEPTED
  X->>J: LISTO T-0123 cambiamos la lampara
  J->>DB: complete_task(outcome resolved, nota con el texto), nota sellada
  DB-->>O: Realtime: tarea cerrada por contacto externo
```

Reglas:
- Los mensajes del contacto externo llegan por la misma línea; el webhook detecta que el teléfono es un `external_contact` y los enruta al protocolo de tareas (no crean conversación de vecino ni disparan el bot).
- Comandos reconocidos (insensibles a mayúsculas/acentos): `ACEPTO <ref>`, `RECHAZO <ref> <motivo>`, `LISTO <ref> <detalle>`, `NO SE PUEDE <ref> <motivo>` (→ `failed`). Si el mensaje no coincide, se responde con la ayuda de comandos.
- Recordatorio automático si no hay respuesta en X horas; al vencer, vuelve a la bolsa del área con evento en el historial.

## 7. Registro progresivo del poblador

1. **Primer contacto**: `unregistered`, teléfono + pushName + foto.
2. **Durante la charla**: el bot pide datos solo cuando hacen falta para el trámite consultado (no un formulario de entrada). Datos confirmados → `source = bot`.
3. **Operador**: completa o corrige desde la ficha lateral del chat → `source = manual` (tiene prioridad).
4. **Registrado**: con nombre + DNI + teléfono, el operador (o el bot, con confirmación) llama a `register_citizen`; la tarjeta de la cola cambia de flag.
5. **Crecimiento**: domicilio, barrio/paraje, email, etiquetas se suman con el uso. La ficha muestra "datos faltantes".
6. **Duplicados**: `merge_citizens(keep, drop)` mueve teléfonos, conversaciones, tareas y notas al que se conserva y marca `merged_into_id`.

## 8. Envío saliente (cualquier origen)

1. Normalizar teléfono a `549…`.
2. Guard de envío (`send_mode`): `dry_run` nunca envía; `allowlist` solo a la lista; bloqueos quedan como `delivery_status = blocked` + `activity_log`.
3. Si es operador: `ensure_owner_for_reply` antes de enviar.
4. Enviar por Evolution (`sendText` / `sendMedia` con `mediatype` correcto: image, document, audio).
5. Guardar mensaje con `external_id`; los estados posteriores llegan por `messages.update`.
6. Actualizar `last_outbound_at`, `needs_response = false`.
