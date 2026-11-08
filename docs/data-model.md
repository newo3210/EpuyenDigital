# Modelo de datos — Mesa de Entrada Digital Epuyén

> Estado: diseño inicial (2026-09-30), actualizado 2026-11-08 con `mesa-entrada-inbox` (migración `supabase/migrations/20261107120000_mesa_entrada_inbox.sql`) además de channel core, foundation y areas. Nombres técnicos en inglés; comentarios en español.
> Convenciones: toda tabla de negocio tiene `id uuid pk`, `org_id uuid not null`, `created_at`, `updated_at` (trigger). RLS habilitado en todas.
> Marcas: **[implementado]** existe en la base; **[pendiente]** columna diseñada que todavía no se creó; el resto es diseño.

## 1. Mapa general

```mermaid
erDiagram
  organizations ||--o{ profiles : tiene
  organizations ||--o{ areas : tiene
  areas ||--o{ area_members : incluye
  profiles ||--o{ area_members : pertenece
  areas ||--o{ external_contacts : tiene
  organizations ||--o{ whatsapp_lines : tiene
  citizens ||--o{ citizen_phones : tiene
  citizens ||--o{ conversations : participa
  whatsapp_lines ||--o{ conversations : recibe
  areas ||--o{ conversations : responsable
  conversations ||--o{ messages : contiene
  conversations ||--o{ conversation_events : registra
  conversations ||--o{ tasks : genera
  tasks ||--o{ task_history : registra
  conversations ||--o{ notes : anota
  tasks ||--o{ notes : anota
  citizens ||--o{ notes : anota
  knowledge_documents ||--o{ knowledge_chunks : trocea
  conversations ||--o{ bot_runs : decide
```

## 2. Organización, equipo y áreas

### `organizations` [implementado]
`name`, `slug unique`, `created_at`. Seed: `epuyen`.
- `timezone` (default `America/Argentina/Buenos_Aires`) **[implementado]**: lo leen el reloj de SLA y el seed. La UI de fechas del panel sigue formateando con `America/Argentina/Buenos_Aires`.

### `profiles` [implementado]
`id = auth.users.id` (on delete cascade), `org_id`, `full_name` (2–80 caracteres), `role user_role default 'operator'`, `avatar_path`, `is_active bool default true`, `created_at`, `updated_at` (trigger `set_updated_at`). Índice `org_id`.
- `email` **[implementado]** (`areas-operators-admin`): copia del email de Auth para el directorio; único por org cuando no es null; no se cambia desde la UI después del alta en v1.
- `deactivated_at` **[implementado]** (`areas-operators-admin`): se setea al desactivar (`is_active = false`) y se limpia al reactivar (trigger `profiles_sync_deactivated_at`).
- Trigger `profiles_guard_privileged_columns`: solo un admin puede cambiar `role`, `org_id` o `is_active`, y nadie desde la API puede cambiar `id` ni `created_at` (si no, error `P0001 forbidden_column`).
- Checks: `profiles_full_name_trimmed_length` (nombre entre 2 y 80 caracteres después de quitar de los bordes los caracteres invisibles: espacios, tabs, NBSP, marcas de ancho cero y bidi, guion suave, rellenos Hangul, blanco braille, selectores de variación (incluido el suplemento y los mongoles), vocales inherentes jemer, U+FFF0–U+FFF8, controles de formato taquigráficos y musicales, y caracteres de etiqueta; además debe quedar al menos una letra o dígito decimal al quitar esos caracteres en todo el texto; la longitud se cuenta en code points) y `profiles_avatar_path_own_folder` (`avatar_path` null o dentro de `{org_id}/{id}/`, sin `..`).
- Altas y bajas solo con service role (seed o futura pantalla de admin); `authenticated` no tiene `INSERT`, `DELETE` ni `MAINTAIN` (permiso nuevo de Postgres 17).

### Bucket `avatars` (Storage) [implementado]
Público para lectura por URL, máximo 2 MB, JPEG/PNG/WebP. Ruta `{org_id}/{user_id}/{uuid}.{ext}`; un usuario solo puede subir, reemplazar o borrar en su propia carpeta, y listar objetos solo de la carpeta de su organización.

### `areas` [implementado]
`name` (único por org, case-insensitive trim), `description`, `color` (`#RRGGBB`), `is_active`, `is_default bool` (una sola por org vía índice parcial + trigger; seed: "Mesa de Entrada"), `sla_warning_minutes`, `sla_critical_minutes` (enteros positivos opcionales; critical ≥ warning).

### `area_members` [implementado]
`area_id`, `user_id`, `is_lead bool`. PK `(area_id, user_id)`. Guard same-org; altas/bajas admin-only (RLS).

### `external_contacts`
Responsables que reciben tareas por WhatsApp sin usar el panel.
`area_id`, `full_name`, `phone_normalized`, `is_active`. Único `(org_id, phone_normalized)`.

### `org_settings` [parcial]
`org_id pk`, `send_mode send_mode default 'allowlist'`, `allowlist_phones text[]`, `bot_paused bool default false`.
- `business_hours jsonb` y `holidays date[]` **[implementado]**: seed lunes a viernes 08:00–14:00, sin feriados. Solo un admin lee la fila y solo `set_business_calendar` escribe esas dos columnas.
- `task_abandon_days`, `privacy_notice`, `out_of_hours_message` siguen **[pendiente]**.

## 3. Canal WhatsApp

### `whatsapp_lines` [implementado — channel core]
`name`, `display_phone`, `evolution_base_url`, `evolution_instance unique`, `default_area_id` (seed → Mesa de Entrada), `status` (`connected` / `disconnected` / `error`), `last_status_at`.

### `whatsapp_line_secrets` [implementado — channel core]
`line_id pk`, `api_key_ciphertext`, `webhook_secret_ciphertext`, legacy `webhook_secret` (plaintext local seed). **RLS sin políticas** + `revoke` a `authenticated`/`anon` (solo service role).

### `quick_replies` [implementado]
`area_id null` (null = todas), `shortcut`, `title`, `body`, `is_active`. Lectura de la organización; alta y baja solo admin. Índice único por org, área y atajo en minúsculas.

## 4. Pobladores

### `citizens`
| Columna | Notas |
|---|---|
| `registration_status citizen_registration` | `unregistered` / `registered` **[implementado channel stub]** |
| `party_kind party_kind` | `person` / `organization` **[implementado channel stub]** |
| `full_name`, `document_id`, `email` | El DNI vive en `document_id` **[implementado ficha]**. Índice único parcial `(org_id, document_id)` cuando no es null y `merged_into_id` es null |
| `address_line`, `neighborhood` | barrio o paraje |
| `whatsapp_push_name`, `whatsapp_avatar_url`, `whatsapp_avatar_fetched_at` | capturados del canal **[implementado]** |
| `latitude`, `longitude` | GPS de domicilio/mascota — **no** pisar con pins de consulta del mensaje |
| `tags text[]`, `observations text` | **[implementado ficha]** |
| `field_sources jsonb` | claves `full_name`, `document_id`, `address_line`, `neighborhood`, `email`, `latitude`, `longitude`, `tags`, `observations`, `party_kind`. Valor `manual` no lo pisa otro escritor **[implementado ficha]** |
| `registered_at`, `registered_by` | los setea `register_citizen` **[implementado ficha]** |
| `merged_into_id uuid null`, `merge_note text` | la fila unificada se conserva, apunta a la que queda, y guarda el motivo **[implementado ficha]** |
| `last_contact_at` | **[pendiente]** |

Índices trigram (`pg_trgm`) sobre `full_name` y `document_id`. Lectura de la organización para `authenticated`. Sin UPDATE/DELETE de `authenticated` sobre `citizens`.

### `citizen_phones`
`citizen_id`, `phone_normalized`, `is_primary`, `source`. **Único `(org_id, phone_normalized)`** → un teléfono pertenece a un solo poblador. Permite varios números por vecino (unificación de duplicados).

## 5. Conversaciones y mensajes

### `conversations` [implementado — inbox]
Transiciones por funciones `SECURITY DEFINER` (`claim_conversation`, `ensure_owner_for_reply`, `delegate_conversation`, `accept_conversation_delegation`, `reject_conversation_delegation`, `move_conversation`, `resolve_conversation`, `set_conversation_area`, `reopen_conversation`). `authenticated` no escribe la tabla.
Una por `(org_id, line_id, phone_normalized)`.

| Columna | Notas |
|---|---|
| `line_id`, `citizen_id`, `phone_normalized` | |
| `area_id not null` | área responsable (default: área de la línea) |
| `bot_state bot_state` | `active` / `handoff` / `paused` (default `active`) |
| `queue_column queue_column` | default `new`; claim/move en inbox |
| `owner_user_id null` | dueño humano (inbox) |
| `delegated_from_user_id`, `pending_area_id`, `awaiting_acceptance bool` | columnas listas; UI/RPC en inbox |
| `entered_queue_at` | cuándo entró a la cola (base del FIFO) |
| `resolved_at`, `resolved_by` | |
| `last_message_at`, `last_inbound_at`, `last_outbound_at` | actualizados en inbound/outbound |
| `needs_response bool` | último mensaje es del vecino y no fue respondido |
| `sla_due_at` | trigger `conversations_sync_sla`: `last_inbound_at` + minutos críticos del área en horario hábil; null si no hay umbral o no `needs_response` |
| `last_message_preview`, `last_message_kind`, `has_attachments` | denormalizados para la tarjeta de cola |
| `topic`, `urgency` | sugeridos por el bot (pendiente) |

Índice para la cola: `(org_id, area_id, owner_user_id nulls first, entered_queue_at)` donde `queue_column <> 'resolved'`.

### `messages` [implementado parcialmente — channel core]
| Columna | Notas |
|---|---|
| `conversation_id`, `direction`, `sender_kind`, `kind`, `body` | `kind` pet/channel (`text`/`image`/…); `content_type` enum pendiente de unificar |
| `author_user_id null` | operador que escribió |
| `media_url`, `media_mime`, `storage_path` | adjunto; bucket `whatsapp-media` / `animal-media` |
| `latitude`, `longitude` | ubicación del **mensaje** (consulta); no escribir a `citizens` |
| `external_id`, `delivery_status` | único `(line_id, external_id)`; ACK Evolution persiste delivered/read |
| `delivered_at`, `read_at` | timestamps de ACK |
| `quoted_external_id`, `transcription`, `media_summary`, `metadata` | **[pendiente]** |

### `conversation_events` [implementado] (append-only)
`conversation_id`, `event_type` (`QUEUED`, `CLAIMED`, `MOVED`, `DELEGATED`, `ACCEPTED`, `REJECTED`, `RESOLVED`, `REOPENED`, `BOT_PAUSED`, `BOT_RESUMED`, `AREA_CHANGED`), `actor_kind`, `actor_user_id`, `from_column`, `to_column`, `from_area_id`, `to_area_id`, `note`, `metadata jsonb`. Sin políticas de escritura para `authenticated`.

### `conversation_reads` [implementado]
`conversation_id`, `user_id`, `last_read_at`, `last_read_message_id`. PK `(conversation_id, user_id)`. Cada operador actualiza solo su fila.

## 6. Tareas y notas

### `tasks`
| Columna | Notas |
|---|---|
| `conversation_id null`, `citizen_id null` | origen |
| `title`, `body`, `kind task_kind`, `priority smallint 1..4` | 1 = urgente |
| `status task_status`, `outcome task_outcome null` | outcome obligatorio al cerrar |
| `audience task_audience` | `self` / `area` / `user` / `external` |
| `area_id`, `assigned_user_id`, `external_contact_id` | según audiencia |
| `awaiting_acceptance bool`, `delegated_from_user_id` | |
| `due_at`, `started_at`, `completed_at`, `completed_by`, `cancelled_at` | |
| `cancel_reason_code cancel_reason`, `cancel_reason_text` | texto obligatorio si `other` |
| `last_activity_at` | base para abandono automático |
| `public_ref` | número corto legible (ej. `T-0123`) para WhatsApp externo |
| `notify_citizen_on_close bool` | |

### `task_history` (append-only)
`task_id`, `event task_event`, `actor_kind`, `actor_user_id`, `external_contact_id`, `from_status`, `to_status`, `from_assignee`, `to_assignee`, `elapsed_ms`, `details jsonb`.

### `task_files`
`task_id`, `storage_path`, `file_name`, `mime`, `size`, `uploaded_by`.

### `notes`
`body`, `kind note_kind`, `author_user_id null` (null = sistema/bot), `conversation_id`, `citizen_id`, `task_id`, `parent_note_id` (respuestas de un nivel), campos de sello: `correlation_id`, `sealed_at`, `content_hash`, `seal_method`. Trigger: nota sellada inmutable y no borrable.

### `note_reads`
`note_id`, `user_id`, `read_at`.

### `entity_mentions`
`source_type (note|task)`, `source_id`, `entity_type (citizen|conversation|task|user|area)`, `entity_id`, `label_snapshot`. Sincronización atómica por función SQL.

## 7. Bot y conocimiento

### `knowledge_documents`
`title`, `source_kind (pdf|text|faq|url)`, `storage_path`, `area_id null`, `is_active`, `valid_until null`, `indexed_at`, `index_status`.

### `knowledge_chunks`
`document_id`, `chunk_index`, `content`, `embedding vector(N)`, `metadata jsonb` (página, sección). Índice HNSW.

### `bot_runs`
`conversation_id`, `trigger_message_id`, `decision bot_decision`, `answer`, `sources jsonb` (chunks citados), `confidence numeric`, `handoff_reason handoff_reason null`, `suggested_area_id`, `topic`, `urgency`, `extracted_fields jsonb`, `model`, `latency_ms`, `tokens_in`, `tokens_out`.

## 8. Operación

### `jobs`
`type job_type`, `status job_status`, `payload jsonb`, `attempts`, `max_attempts`, `run_after`, `locked_at`, `locked_by`, `last_error`. Consumo con `FOR UPDATE SKIP LOCKED`.

### `activity_log` (append-only)
`actor_user_id`, `action activity_action`, `citizen_id`, `conversation_id`, `task_id`, `details jsonb`.

### `error_logs` [implementado]
`org_id null` (null = error sin operador identificado, p. ej. antes del login), `source (web|api|worker|db)`, `level error_level`, `origin (server|client) default 'server'`, `status error_status default 'open'`, `trace_id`, `message`, `details jsonb` (redactado; incluye `digestRef` para unir el reporte del navegador con el del servidor), `user_id null`, `resolved_by`, `resolved_at`, `created_at`. Índices `(org_id, status, created_at desc)`, `trace_id` y parcial `error_logs_client_reports_idx (user_id, created_at desc) where origin = 'client'` (límite de reportes).
- Los reportes del navegador se guardan con la función `insert_client_error_report` (solo service role): toma un advisory lock por usuario, cuenta las filas `origin = 'client'` de los últimos 60 s y, si ya hay 10, devuelve null en lugar de insertar. Rechaza (`22023 invalid_argument`) un usuario nulo o un límite o ventana nulos o menores que 1. Así el límite se cumple aunque lleguen muchos pedidos a la vez.
- Los errores del servidor guardan `org_id` y `user_id` del operador conectado cuando hay sesión.
- Los errores del futuro webhook de Evolution se registran con `source = 'api'` (es un route handler); no hay valor `webhook`.
- Inserción solo con service role (la app usa el cliente admin en el servidor).
- Trigger `error_logs_guard_update`: solo se puede cambiar `status` (nunca `origin`); al pasar a `resolved` sella `resolved_by = auth.uid()` y `resolved_at = now()`, y los limpia al reabrir.
- Purga automática a 30 días: función `purge_error_logs()` (solo service role) programada con `pg_cron` todos los días 06:00 UTC.

## 9. Enums

| Enum | Valores |
|---|---|
| `user_role` [implementado] | `admin`, `area_lead`, `operator`, `support` |
| `error_level` [implementado] | `error`, `warn`, `info` |
| `error_status` [implementado] | `open`, `acknowledged`, `resolved` |
| `line_status` | `connected`, `disconnected`, `error` |
| `send_mode` | `dry_run`, `allowlist`, `production` |
| `citizen_registration` | `unregistered`, `registered` |
| `party_kind` | `person`, `organization` |
| `bot_state` | `active`, `handoff`, `paused` |
| `queue_column` | `new`, `claimed`, `in_progress`, `waiting_external`, `resolved` |
| `message_direction` | `inbound`, `outbound` |
| `sender_kind` | `citizen`, `bot`, `operator`, `phone` (escrito desde el teléfono), `system` |
| `content_type` | `text`, `image`, `audio`, `video`, `document`, `location`, `sticker`, `contact`, `unsupported` |
| `media_status` | `none`, `pending`, `stored`, `failed` |
| `delivery_status` | `pending`, `sent`, `delivered`, `read`, `failed`, `blocked` |
| `conversation_event_type` | `QUEUED`, `CLAIMED`, `MOVED`, `DELEGATED`, `ACCEPTED`, `REJECTED`, `RESOLVED`, `REOPENED`, `BOT_PAUSED`, `BOT_RESUMED`, `AREA_CHANGED` |
| `actor_kind` | `operator`, `bot`, `system`, `external` |
| `task_kind` | `inquiry`, `complaint`, `procedure`, `documentation`, `referral`, `other` |
| `task_status` | `pending`, `in_progress`, `done`, `cancelled`, `failed` |
| `task_outcome` | `resolved`, `abandoned`, `referred_outside`, `citizen_unresponsive`, `duplicate` |
| `task_audience` | `self`, `area`, `user`, `external` |
| `cancel_reason` | `citizen_unresponsive`, `duplicate`, `not_municipal`, `resolved_other_channel`, `wrong_area`, `other` |
| `task_event` | `CREATED`, `CLAIMED`, `DELEGATED`, `ACCEPTED`, `REJECTED`, `STATUS_CHANGED`, `DUE_CHANGED`, `NOTE_ADDED`, `COMPLETED`, `CANCELLED`, `FAILED`, `REOPENED`, `ABANDONED`, `EXTERNAL_NOTIFIED`, `EXTERNAL_REPLIED`, `BOT_CREATED` |
| `note_kind` | `observation`, `status_update`, `system`, `audit`, `bot_summary` |
| `bot_decision` | `answered`, `asked_clarification`, `handoff`, `silent` |
| `handoff_reason` | `low_confidence`, `sensitive_topic`, `citizen_requested`, `out_of_hours`, `media_needs_review`, `error` |
| `job_type` | `media.download`, `media.transcribe`, `media.read`, `bot.reply`, `outbound.send`, `external.notify`, `knowledge.index` |
| `job_status` | `queued`, `running`, `done`, `failed` |

## 10. Reglas de acceso (RLS)

| Recurso | admin | area_lead | operator | support |
|---|---|---|---|---|
| Conversaciones / mensajes | todas | de sus áreas | de sus áreas + propias + delegadas a él | lectura |
| Pobladores | todos | todos (lectura/edición) | todos (lectura/edición) | lectura |
| Tareas | todas | de sus áreas | de sus áreas + asignadas a él | lectura |
| Notas | todas | según entidad | según entidad | lectura |
| Áreas, operadores, líneas, settings | escritura | lectura (y miembros de su área) | lectura | lectura |
| Historial / eventos / activity_log | solo insert por funciones; lectura según entidad | | | |
| Secretos | nadie (service role) | | | |
| error_logs | lectura + cambiar estado (su org) | — | — | lectura + cambiar estado (su org y filas con `org_id` null) |

**Implementado hoy (nivel organización + áreas):** las funciones `current_org_id()` y `current_user_role()` (`security definer`, `stable`, `search_path = ''`) devuelven null si el perfil no existe o está inactivo, así que un usuario desactivado no coincide con ninguna política. `current_area_ids()` devuelve las membresías del operador activo (vacío si inactivo). `organizations`: lectura de la propia org. `profiles`: lectura de la propia org; actualización de la fila propia o, para admin, de cualquier fila de su org; trigger last-admin. `areas` / `area_members`: lectura org; escrituras admin. `anon` no tiene permisos. `authenticated` no tiene `INSERT` en `profiles` (altas con service role). La aplicación de `current_area_ids()` a conversaciones/tareas queda para `mesa-entrada-inbox`.

## 11. Funciones SQL (transiciones atómicas)

Todas `security invoker` (salvo sellado), filtran por `current_org_id()`, toman `FOR UPDATE`, validan estado esperado y escriben su evento en la misma transacción.

- Conversaciones: `claim_conversation`, `delegate_conversation(target_user | target_area, note)`, `accept_conversation_delegation`, `reject_conversation_delegation(note)`, `ensure_owner_for_reply`, `move_conversation(column)`, `resolve_conversation`, `reopen_conversation` (usada por el webhook), `set_conversation_area`.
- Tareas: `create_task`, `claim_task`, `delegate_task`, `accept_task`, `reject_task`, `start_task`, `complete_task(outcome)`, `cancel_task(reason, text)`, `reopen_task`, `abandon_stale_tasks()` (pg_cron).
- Pobladores (`SECURITY DEFINER`): `update_citizen_profile`, `register_citizen`, `search_citizens`, `merge_citizens(keep, drop, note)`, `list_citizen_timeline`. El trigger `citizens_guard_manual_fields` restaura una columna `manual` salvo cuando la sesión trae `app.citizen_field_write = operator`. La unificación no usa esa bandera: el motivo queda en `merge_note`.
- Auditoría: `seal_audit_note(correlation_id, ...)` (security definer, solo service role).
