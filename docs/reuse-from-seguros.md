# Reutilización desde el CRM de seguros

> Fuente: `newo3210/seguros` (privado), revisado el 2026-09-30 sobre `main`. Rutas relativas a la raíz de ese repo.
> Criterio: **arrancar limpio** y portar pieza por pieza. Nada se copia sin revisar; cada pieza trae su corrección.

Leyenda: **Portar** = copiar y renombrar · **Adaptar** = tomar la lógica y reescribir el modelo · **Patrón** = solo la idea · **Descartar**.

## 1. Canal WhatsApp — Phase 2

| Pieza | Origen | Acción | Corrección obligatoria |
|---|---|---|---|
| Stack Evolution (compose) | `docker-compose.evolution.yml`, `.env.evolution.example` | Portar | Renombrar cliente `AseguradoraCRM`; agregar eventos `MESSAGES_UPDATE`, `CONNECTION_UPDATE` |
| Runbook Evolution | `docs/runbooks/evolution-whatsapp-gateway.md` | Adaptar | Instancias por línea (no `cobranza`/`marketing`) |
| Instalador on-prem (Podman + Cloudflare Tunnel) | `docs/runbooks/admin-host-onprem-pack.md`, `scripts/admin-host/*.ps1`, `packaging/admin-host-installer/` | Adaptar | Quitar session-api y login del portal |
| Normalización del webhook | `apps/web/src/lib/whatsapp/evolution-webhook.ts` | Adaptar | **Soportar media entrante** (hoy `no_text` descarta todo); resolver `@lid`; guardar `fromMe` como saliente; capturar `pushName` |
| Comparación de secreto | `evolution-webhook.ts` → `evolutionSecretsMatch` | Portar | **Sin secreto = rechazar** (hoy devuelve `true`) |
| Ruta del webhook | `apps/web/src/app/api/webhooks/whatsapp/evolution/route.ts` | Adaptar | Solo persistir + encolar jobs; quitar fallback `DEFAULT_ORG_ID` |
| Cliente Evolution | `apps/web/src/lib/whatsapp/evolution-client.ts` | Portar | Enviar imágenes como `image` (hoy todo va como `document`); agregar audio y descarga de media |
| Router de salida | `apps/web/src/lib/whatsapp/outbound-router.ts` | Adaptar | Solo Evolution en v1, interfaz lista para Meta |
| Resolución de transporte + secretos cifrados | `lib/whatsapp/resolve-transport.ts`, `lib/crypto/credentials.ts` | Portar | Clave dedicada `CREDENTIALS_ENCRYPTION_KEY` sin fallback a service role |
| Guard de envío (`dry_run`/`allowlist`/`production`) | `lib/whatsapp/send-mode.ts`, migración `20260724160000_whatsapp_send_mode.sql` | Portar | — |
| Normalización de teléfonos AR | `lib/phone/ar-whatsapp.ts` (+ tests) | Portar | — (ya cubre área 2945) |
| Idempotencia de mensajes | `lib/whatsapp/supabase-store.ts`, `persistence.ts` | Adaptar | Único por `(line_id, external_id)`; **reemplazar `findClientByPhone` O(n)** por lookup indexado en `citizen_phones` |
| Foto de perfil | `lib/whatsapp/refresh-client-avatar.ts` | Portar | Hacerlo en worker, no en render |
| Bucket de media | migración `20260712150100_whatsapp_media_bucket.sql`, `send-operator-media.ts` | Adaptar | Bucket propio `whatsapp-media` (no `policy-documents`) con política por org |

## 2. Panel de mensajería — Phase 3

| Pieza | Origen | Acción | Corrección obligatoria |
|---|---|---|---|
| Columnas de cola + eventos | migración `20260719145000_inbox_kanban.sql` | Adaptar | Renombrar enums; agregar `REOPENED`, `BOT_PAUSED`, `BOT_RESUMED`, `AREA_CHANGED` |
| Claim / delegate / accept / reject / ensure-owner | migraciones `20260930140000_conversation_claim_delegate_accept.sql` + `20260930150000_fix_claim_kanban_column_ambiguous.sql` | Portar | Agregar **delegación a área**; `RETURNS TABLE` sin nombres ambiguos desde el inicio |
| Orden sin-dueño-primero FIFO | `apps/web/src/lib/inbox/portfolio-kanban.ts` → `sortThreadsForExternalBoard` | Portar | Hacerlo en SQL (índice), no en memoria |
| Tipos y carga de la cola | `lib/data/inbox-kanban.ts`, `inbox-types.ts` | Adaptar | **No traer todos los mensajes** para el preview: usar `last_message_*` denormalizado |
| Propiedad de conversación | `lib/inbox/conversation-ownership.ts` | Portar | — |
| Tarjeta + menú contextual | `components/inbox/inbox-external-chat-card.tsx` | Adaptar | Aceptar/rechazar en **todas** las vistas; "Eliminar" debe decir "Resolver" |
| Composer | `components/inbox/message-composer.tsx` | Portar | Agregar respuestas rápidas y audio |
| Hilo + adjuntos | `components/inbox/message-thread.tsx`, `message-attachment.tsx` | Portar | Reproductor de audio, visor de ubicación |
| Notificaciones en tiempo real + dock | `components/layout/inbox-notifications-provider.tsx`, `whatsapp-dock.tsx`, `lib/inbox/dock-badge.ts` | Adaptar | Aplicar cambios parciales (no refetch total); contar por área |
| Publicación Realtime | migración `20260712150000_realtime_messaging_publication.sql` | Portar | — |
| SLA | `computeSlaStatus` en `inbox-kanban.ts` | Adaptar | Configurable por área + horario hábil; escribir `sla_due_at` |
| Leído / no leído | — (no existe) | Nuevo | `conversation_reads` |

## 3. Chatbot — Phase 6

| Pieza | Origen | Acción | Corrección obligatoria |
|---|---|---|---|
| Handoff silencioso a la cola | `lib/whatsapp/persistence.ts` → `applySilentInboxHandoff`, `needsSilentInboxHandoff` | Portar | — |
| Pausa global + apagado de emergencia | migración `20260929130000_menu_bot_paused.sql`, `isMenuBotPaused` | Portar | — |
| Máquina de estados de menú | `lib/whatsapp/menu-state-machine.ts` | Patrón | Reemplazar por LLM + `bot_state`; **no volver a `CLIENT_MENU` cuando responde un operador** (`send-operator-message.ts:153`, `send-operator-media.ts:249`) |
| Acuse "tu consulta fue recibida" | `persistence.ts` (estado `OPERATOR_HANDOFF`) | Adaptar | **Una vez por episodio**, no en cada mensaje |
| Envío masivo con pausas anti-bloqueo | `lib/messaging-bot/**`, `workers/scraper/python/scraper_worker/messaging_bot.py` | Patrón (v2) | Para avisos municipales; el `on_conflict="org_id,phone"` del worker está roto |

## 4. Pobladores — Phase 4

| Pieza | Origen | Acción | Corrección obligatoria |
|---|---|---|---|
| Modelo cliente + potencial + trigger de conversión | migraciones `20260714121000_inbox_context_menu_crm_backend.sql`, `20260930010000_potential_clients_lite_360.sql` | Adaptar | **Tabla única `citizens`** con `registration_status` + `citizen_phones` |
| Origen del dato (`*_source`, manual no se pisa) | `api/clients/[id]/contact/route.ts`, `lib/clients/party-kind.ts` | Patrón | Generalizar a `field_sources jsonb` |
| Heurística persona/organización (CUIT) | migración `20260815220000_clients_party_kind_cuit_name_heuristic.sql`, `lib/clients/party-kind.ts` | Portar | — |
| Ficha lite 360 | `components/inbox/non-client-360-view.tsx`, `lib/data/non-client-360-workspace.ts` | Adaptar | Campos municipales; acción "Registrar" (en el CRM la web nunca crea clientes) |
| Timeline de la persona | `lib/activity/client-timeline.ts`, `client-timeline-model.ts`, `components/clients/client-timeline.tsx` | Portar | Incluir `conversation_events`; que funcione también para no registrados |
| Marcas operativas (contactado hoy/mes) | `lib/clients/ops-status.ts`, `ops-status-load.ts` | Portar | Quitar `fullyUpdated` |
| Menú contextual de persona | `components/people/person-context-menu.tsx` + helpers | Adaptar | Quitar cupón/campaña |
| Búsqueda trigram | migración `20260805152747_clients_query_trgm_indexes.sql` | Portar | — |
| Importación Excel/CSV | `lib/ingestion/excel-pipeline.ts` | Patrón (v2) | Hoy está atada a cuotas |

## 5. Tareas, notas y trazabilidad — Phase 5

| Pieza | Origen | Acción | Corrección obligatoria |
|---|---|---|---|
| Ciclo de vida de tareas | `lib/producer-ops/task-lifecycle.ts`, `task-transitions.ts`, migraciones `20260805170000..170003` | Adaptar | **Transiciones en funciones SQL atómicas** (hoy update + insert separados); `claim` con `FOR UPDATE` |
| Audiencia y delegación con aceptación | migración `20260814150000_tasks_evolution_audience.sql`, `planTaskCreateFields` | Adaptar | Agregar audiencias `area` y `external` |
| Historial de tareas | migración `20260805170002_task_history_log.sql`, `lib/producer-ops/task-history.ts` | Portar | **RLS solo select + insert por función** (hoy `FOR ALL`) |
| Sesiones de trabajo | migración `20260815180000_task_work_sessions.sql`, `lib/producer-ops/task-work-session.ts` | Patrón | Opcional; atribución por conversación, no por cliente |
| Motivo obligatorio de cancelación | `lib/action-audit/cancel-catalog.ts` | Adaptar | Catálogo municipal; exigir en **toda** cancelación |
| Notas con menciones y respuestas | migraciones `20260801170000`, `20260801180000`, `20260822180000`, `20260824220000`; `lib/mentions/*` | Adaptar | Tipos de entidad municipales; una sola tabla `notes` (sin doble escritura); aplicar audiencia en RLS |
| Nota → tarea | `spawnTaskFromNoteAction` | Portar | — |
| Sellado de auditoría (hash + correlation-id) | migraciones `20260812120000..20260812140001`, `lib/action-audit/seal.ts`, `correlation-seal.ts` | Portar | **Trigger `before delete`** para notas selladas; generalizar a todas las transiciones relevantes |
| Transición atómica con auditoría | migración `20260812140000_action_audit_correlation_seal_rpc.sql` | Patrón | Base para todas las funciones de tareas |
| Activity log inmutable | migración `20260630130000_activity_log_policy_context.sql`, `lib/activity/log.ts` | Adaptar | Enum municipal |
| Delegación a áreas / externos | — (no existe) | Nuevo | `areas`, `area_members`, `external_contacts`, protocolo por WhatsApp |

## 6. Fundación — Phase 1

| Pieza | Origen | Acción | Corrección obligatoria |
|---|---|---|---|
| Organizaciones, perfiles, helpers RLS | migraciones `20260615100000_core_tenant_tables.sql`, `20260615100300_rls_policies.sql` | Adaptar | Agregar `current_area_ids()` y RLS por área |
| Guards de auth | `lib/auth/session.ts`, `lib/auth/api-guard.ts`, `middleware.ts` | Portar | Limpiar roles fantasma (`producer`, `ADMIN`) |
| Alta de miembros | `api/settings/members`, `lib/data/org-members.ts` | Adaptar | Agregar editar rol y desactivar |
| Avatares | migración `20260929160000_profile_avatars.sql`, `lib/data/profile-avatar.ts` | Portar | — |
| Registro de errores + soporte | migraciones `20260822140000_error_logs.sql`, `20260929170000_...`; `lib/errors/redact.ts`, `trace.ts`; `components/errors/*` | Portar | Fuente `webhook` y `worker` |
| Test de aislamiento RLS | `supabase/tests/rls_isolation_test.sql` | Portar | Correrlo en CI |
| Sistema de diseño | `DESIGN.md`, `globals.css`, `tailwind.config.ts`, `components/ui/*`, `components/layout/app-shell.tsx`, `app-sidebar.tsx` | Adaptar | Paleta institucional Epuyén |
| Textos es-AR | `lib/i18n/es-AR.ts` | Patrón | Empezar vacío; solo textos municipales |

## 7. Métricas — Phase 7

| Pieza | Origen | Acción | Nota |
|---|---|---|---|
| Primera respuesta y SLA | `lib/score/record-score-event.ts`, migración `20260723130000_operator_score.sql` | Adaptar | Métricas sin ranking en v1; puntaje/gamificación en v2 |
| Serie diaria | migración `20260825150000_org_score_daily_series.sql` | Portar | — |
| Proceso con specs (OpenSpec, reglas Cursor) | `openspec/`, `.cursor/commands/opsx-*`, `docs/base-standards.md` | Patrón | En este proyecto se usa GSD (`.planning/`) |
| CI | `.github/workflows/ci.yml` | Adaptar | **Correr tests** (el CRM no los corre) |

## 8. Descartar (específico de seguros)

- `workers/scraper/**` (Python, Camoufox, adaptadores Rivadavia, session-api, messaging bot de cobranza).
- `apps/pas-sandbox`, `apps/public-web`.
- Pólizas, cuotas, documentos de seguro, cupones, endosos, cotizaciones, ex-clientes, novedades operativas, sesiones de vencimiento, sincronización/enriquecimiento, `sync_jobs`.
- `lib/portal-session`, `lib/pas`, `lib/ingestion/*` (versión cuotas), `lib/action-audit` (flujo PAS), `deliver-bot-coupon.ts`, `operator-document-companion.ts` (el patrón "texto + documento" sí sirve para envíos oficiales).
- Maqueta de calendario (`lib/data/calendar-desk-mock.ts`).
- Configs Railway y compose de workers de seguros.

## 9. Bugs del CRM que NO se heredan (checklist)

- [ ] Media entrante descartada (Evolution `no_text`; Meta guarda `content = null`)
- [ ] Bot vuelve a menú cuando responde un operador
- [ ] Acuse de handoff repetido en cada mensaje
- [ ] Conversación resuelta no se reabre si el bot está activo
- [ ] Webhook Evolution abierto sin secreto
- [ ] JIDs `@lid` sin resolver
- [ ] `fromMe` y estados de entrega ignorados
- [ ] Imágenes enviadas como documento
- [ ] `findClientByPhone` y carga de cola O(n)
- [ ] Realtime con refetch total
- [ ] `sla_breach_at` nunca escrito; SLA fijo en código
- [ ] Sin leído/no leído por conversación
- [ ] Transiciones de tareas no atómicas; claim sin bloqueo
- [ ] Historial, sesiones y notas selladas borrables desde el cliente
- [ ] Audiencia de notas no aplicada
- [ ] Doble escritura `notes` / `operator_notes`
- [ ] Fallback de clave de cifrado a service role; `DEFAULT_ORG_ID`
- [ ] CI sin tests
