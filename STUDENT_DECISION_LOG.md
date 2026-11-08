# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-11-08  
**Change relacionado:** `mesa-entrada-inbox`

---

## 1. Resumen de la decisión

Se implementa el **núcleo del canal WhatsApp** (WA-01..12 a nivel canal) antes de la cola de Mesa de Entrada. Aparecen `conversations`, secretos cifrados de línea, webhook endurecido, composer mínimo y persistencia de estados de entrega. El registro de mascotas de Inspectoría sigue en la misma línea; el área por defecto de la línea apunta a Mesa de Entrada.

Decisiones de diseño de este change (D1–D8):

| Id | Decisión | Por qué |
|---|---|---|
| D1 | Crear `conversations` ahora (claim después) | El inbox necesita hilos; no bloquear el canal |
| D2 | Evolucionar `messages` hacia adelante (`conversation_id`) | No romper el log del bot de mascotas |
| D3 | Cifrar API key + webhook secret con `CREDENTIALS_ENCRYPTION_KEY` | Sin fallback a service role (bug del CRM) |
| D4 | `default_area_id` de la línea → Mesa de Entrada | Un solo número compartido Mesa + Inspectoría |
| D5 | Ubicación solo en el mensaje | No pisar GPS de mascotas en `citizens` |
| D6 | Composer mínimo en `/inbox` | Evitar página throwaway; claim queda fuera |
| D7 | Portar normalización/send_mode desde seguros con correcciones | Media, `@lid`, fromMe, secreto obligatorio |
| D8 | Convivencia con `process-inbound` | Idempotencia `(line_id, external_id)`; media download idempotente |

Secuencia WA → inbox: este change deja hilos + mensajes + área default; `mesa-entrada-inbox` agrega claim, delegación, mapa de consulta, ticks UI y RLS por área.

## 2. Mapa de flujo de datos

### 2.1 Webhook entrante

```text
WhatsApp → Evolution → POST /api/webhooks/evolution
  → normalize (ignora grupos/broadcast/newsletter; resuelve @lid; fromMe)
  → verifica secreto de la línea (sin secreto = rechazo)
  → upsert ciudadano stub + conversation (área default)
  → inserta message idempotente
  → encola process_inbound (+ download_media si hay media)
  → messages.update → actualiza delivery_status
```

### 2.2 Composer saliente

```text
Operador → /inbox/[id] → sendComposerTextAction
  → decideSend(send_mode de la org)
  → dry_run / allowlist bloqueado: persiste sin Evolution
  → production: sendText Evolution + message outbound
```

### 2.3 Admin de líneas

```text
Admin → /settings/lines
  → guarda línea (RLS) + secretos cifrados (service role)
  → Probar conexión → status connected/disconnected/error
```

## 3. Justificación de arquitectura limpia

- La ruta del webhook solo normaliza y orquesta; no habla con LLM ni descarga media.
- Casos de uso (`createLine`, `sendOperatorText`, `testLineConnection`) concentran reglas.
- Repositorios e infraestructura (Supabase, Evolution, AES) no conocen copy de UI.
- Contratos Zod en shared/web delimita webhook, ACK, composer y líneas.

## 4. Control de salida / secretos

- Secretos nunca vuelven a la UI en claro (solo flags “ya configurado”).
- Logs no imprimen API keys ni webhook secrets.
- `send_mode` es el único interruptor que permite o bloquea Evolution.

## 5. Glosario breve

| Término | Significado |
|---|---|
| Línea | Instancia Evolution + teléfono municipal |
| Conversación | Hilo único por org/línea/teléfono normalizado `549…` |
| fromMe | Mensaje escrito desde el teléfono de la línea (sale como outbound) |
| dry_run | Modo que persiste el intento y no llama a Evolution |
| Mesa de Entrada | Área default del canal compartido |
| Tomar (claim) | El primer operador que puede ver un hilo sin dueño se lo queda y pausa el bot |
| Delegar | Pasa el hilo a una persona o a un área, con nota, y espera aceptación |
| Horario hábil | Minutos de SLA que solo corren de lunes a viernes 08:00–14:00, salvo feriados |
| Reapertura | Un mensaje nuevo del vecino sobre un hilo resuelto lo vuelve a la cola, sin dueño |

## 6. Historial reciente

- 2026-11-06: `areas-operators-admin` archivado.
- 2026-11-06: `whatsapp-channel-core` archivado.
- 2026-11-08: `mesa-entrada-inbox` archivado en `openspec/changes/archive/2026-11-08-mesa-entrada-inbox`. Specs vivas en `openspec/specs/inbox-queue`, `conversation-ownership` e `inbox-thread`.

## 7. Mesa de entrada — por qué las funciones son definer

El texto viejo del modelo de datos hablaba de security invoker. Si el invoker puede hacer UPDATE, cualquier operador que ve la fila puede escribirse como dueño. Si el invoker no puede hacer UPDATE, nadie puede tomar el hilo. Por eso las transiciones (`claim`, `delegate`, `accept`, `reject`, `move`, `resolve`, `set area`, `reopen`) son `SECURITY DEFINER` con `search_path = ''` y chequean `auth.uid()`, el rol y el área. El rol `authenticated` no inserta ni actualiza `conversations`, `messages` ni `conversation_events`.

`reopen_conversation` solo corre con service role, desde el webhook, y es idempotente por id de mensaje: un webhook duplicado no escribe un segundo `REOPENED`.

El SLA vive en SQL (`add_business_minutes` + trigger). El espejo de TypeScript sirve para los tests de calendario. Viernes 13:00 ART + 120 minutos hábiles (la ventana cierra a las 14:00) cae el lunes a las 09:00, no a las 10:00. Lunes 08:00 + 120 minutos sí es lunes 10:00.

## 8. Por qué el job de mascotas sigue

La línea compartida nace en Mesa de Entrada. Si `process_inbound` se apagara salvo cuando el área es Inspectoría, el registro de mascotas que ya está en producción dejaría de contestar. Cambiar el área a mano es una etiqueta humana. No cambia quién recibe el job.

## 9. Flujo de la cola

```text
Vecino → webhook → mensaje
  → si el hilo estaba resuelto: reopen (columna new, sin dueño)
  → igual se encola process_inbound
Operador → /inbox (orden SQL: sin dueño por entered_queue_at, después con dueño por último inbound)
  → tomar / delegar / aceptar / rechazar / mover / resolver / cambiar área
  → responder: ensure_owner_for_reply antes de persistir o llamar a Evolution
Soporte: lee toda la organización y no ve controles que mutan
```
