# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-11-06  
**Change relacionado:** `whatsapp-channel-core`

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

## 6. Historial reciente

- 2026-11-06: `areas-operators-admin` archivado.
- 2026-11-06: implementación de `whatsapp-channel-core` (sin archivar; falta verify/adversarial/human OK).
