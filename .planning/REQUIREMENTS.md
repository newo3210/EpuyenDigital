# Requirements: Mesa de Entrada Digital — Municipio de Epuyén

**Defined:** 2026-09-30
**Core Value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: o lo resuelve el bot con información oficial, o entra a una cola visible donde un humano lo toma, lo deriva y lo cierra con trazabilidad completa.

Referencias: modelo de datos en `docs/data-model.md`, flujos en `docs/flows.md`, origen de cada pieza en `docs/reuse-from-seguros.md`.

## v1 Requirements

### Fundación (FND)

- [x] **FND-01**: Operador puede iniciar sesión con email y contraseña y la sesión persiste entre recargas *(implementado en `foundation-workspace-auth`, pendiente de review/archive)*
- [ ] **FND-02**: Admin puede crear operadores con rol (`admin`, `area_lead`, `operator`) y contraseña temporal
- [ ] **FND-03**: Admin puede editar el rol de un operador y desactivarlo (sin borrar su historial)
- [ ] **FND-04**: Admin puede crear áreas municipales (nombre, descripción, color, activa/inactiva)
- [ ] **FND-05**: Admin puede asignar operadores a una o más áreas
- [ ] **FND-06**: Toda tabla de negocio está aislada por organización (RLS) y el acceso a conversaciones/tareas respeta el área del operador *(parcial: aislamiento por organización implementado en `foundation-workspace-auth`; nivel área en `areas-operators-admin`)*
- [x] **FND-07**: Operador puede editar su nombre y avatar *(implementado en `foundation-workspace-auth`, pendiente de review/archive)*
- [x] **FND-08**: Los errores de web, API y webhook se registran con trace-id, enmascarando DNI/CUIT/teléfono, y soporte puede verlos y marcarlos resueltos *(implementado en `foundation-workspace-auth`; el webhook de la fase 2 queda cubierto por `onRequestError` como route handler, `source = 'api'`)*

### Canal WhatsApp (WA)

- [ ] **WA-01**: Admin puede configurar una o más líneas WhatsApp (instancia Evolution, URL, API key cifrada, secreto de webhook cifrado, área por defecto)
- [ ] **WA-02**: Admin puede probar la conexión de una línea y ver su estado (conectada / desconectada)
- [ ] **WA-03**: El webhook rechaza toda llamada sin secreto válido (nunca queda abierto)
- [ ] **WA-04**: Los mensajes entrantes de texto se guardan una sola vez (idempotencia por id externo), ignorando grupos, difusiones y newsletters
- [ ] **WA-05**: Los adjuntos entrantes (imagen, audio, video, documento, ubicación, sticker) se descargan, se guardan en Storage y se ven en el hilo con su texto al pie
- [ ] **WA-06**: El sistema resuelve el teléfono real también para JIDs `@lid`
- [ ] **WA-07**: El sistema captura el nombre de perfil de WhatsApp (pushName) y la foto de perfil del contacto
- [ ] **WA-08**: Operador puede enviar texto, imagen, documento PDF y audio desde el panel
- [ ] **WA-09**: Lo que se escribe desde el teléfono de la línea (fromMe) se refleja en el hilo como saliente
- [ ] **WA-10**: Los estados entregado / leído de los mensajes salientes se reflejan en el hilo
- [ ] **WA-11**: Admin puede elegir el modo de envío (`dry_run`, `allowlist`, `production`) y todo envío saliente (bot y operador) respeta ese guard
- [ ] **WA-12**: Los teléfonos se normalizan al formato argentino canónico `549…` al guardar y al enviar

### Panel de mensajería (INB)

- [ ] **INB-01**: Operador ve una cola de conversaciones donde las que no tienen dueño aparecen primero en orden FIFO (la que más espera arriba)
- [ ] **INB-02**: Operador puede tomar (claim) una conversación sin dueño; si otro la tomó antes, recibe un aviso de conflicto
- [ ] **INB-03**: Responder una conversación sin dueño la toma automáticamente; responder una delegación pendiente propia la acepta
- [ ] **INB-04**: Operador dueño puede delegar una conversación a otro operador o a un área, con nota
- [ ] **INB-05**: El destinatario de una delegación puede aceptarla o rechazarla con motivo; al rechazar vuelve a quien la delegó
- [ ] **INB-06**: Operador dueño puede mover la conversación entre columnas (tomada, en curso, esperando externo) y resolverla
- [ ] **INB-07**: Si el vecino escribe sobre una conversación resuelta, vuelve a la cola como nueva
- [ ] **INB-08**: Cada conversación muestra su línea de eventos (derivación del bot, tomada, movida, delegada, aceptada, rechazada, resuelta, reabierta) con actor y fecha/hora
- [ ] **INB-09**: La cola y el hilo se actualizan en tiempo real sin recargar
- [ ] **INB-10**: Cada tarjeta muestra flags: fecha/hora del último mensaje, registrado / no registrado, dueño, área, delegación pendiente, necesita respuesta, SLA (ok / aviso / crítico), bot activo / pausado, tiene adjuntos
- [ ] **INB-11**: Operador puede filtrar la cola por área, línea, dueño, "esperando mi aceptación", "sin responder" y "con adjuntos"
- [ ] **INB-12**: El sistema registra leído / no leído por conversación y por operador
- [ ] **INB-13**: Operador puede usar respuestas rápidas (plantillas municipales) desde el composer
- [ ] **INB-14**: Operador recibe aviso en el panel (badge + sonido opcional) cuando entra un mensaje nuevo o le delegan algo
- [ ] **INB-15**: El SLA se configura por área y cuenta solo horario hábil

### Pobladores (POB)

- [ ] **POB-01**: Todo contacto nuevo de WhatsApp crea automáticamente un poblador en estado "no registrado" con teléfono, pushName y foto
- [ ] **POB-02**: Operador puede ver y editar la ficha del poblador (nombre, DNI, domicilio, barrio/paraje, email, etiquetas, observaciones) desde el chat
- [ ] **POB-03**: Operador puede marcar a un poblador como "registrado" cuando tiene los datos mínimos (nombre + DNI + teléfono)
- [ ] **POB-04**: Cada dato de la ficha guarda su origen (manual, bot, importación) y lo cargado manualmente no se pisa automáticamente
- [ ] **POB-05**: La ficha muestra qué datos faltan para completar el registro (registro progresivo)
- [ ] **POB-06**: Operador puede buscar pobladores por nombre, DNI o teléfono con resultados instantáneos
- [ ] **POB-07**: La ficha muestra el timeline del poblador: mensajes, eventos de conversación, notas y tareas
- [ ] **POB-08**: Operador puede unificar dos pobladores duplicados (mismo vecino con dos números), conservando historial
- [ ] **POB-09**: Operador puede distinguir persona / organización (comercio, cooperativa, asociación)

### Tareas y notas (TSK)

- [ ] **TSK-01**: Operador puede crear una tarea desde una conversación en un clic (queda vinculada a la conversación y al poblador)
- [ ] **TSK-02**: La tarea tiene tipo (consulta, reclamo, trámite, documentación, derivación, otro), prioridad, vencimiento y adjuntos
- [ ] **TSK-03**: La tarea puede quedar para mí, en la bolsa de un área (cualquiera del área la toma) o delegada a una persona con aceptación
- [ ] **TSK-04**: Una tarea puede delegarse a un número WhatsApp externo registrado como contacto de área; el externo recibe la tarea por WhatsApp y puede aceptar, rechazar o cerrar respondiendo
- [ ] **TSK-05**: La tarea sigue el ciclo pendiente → en curso → terminada / cancelada / fallida, con reapertura
- [ ] **TSK-06**: Al cerrar se registra el resultado (resuelta, abandonada, derivada fuera del municipio, sin respuesta del vecino) y quién la resolvió
- [ ] **TSK-07**: Cancelar exige motivo del catálogo municipal (o texto libre si es "otro")
- [ ] **TSK-08**: Las tareas sin actividad por N días (configurable) se marcan automáticamente como abandonadas
- [ ] **TSK-09**: Operador puede crear notas internas en una conversación, poblador o tarea, con menciones (@usuario, poblador, tarea) y respuestas de un nivel
- [ ] **TSK-10**: Operador puede convertir una nota en tarea
- [ ] **TSK-11**: Operador ve un tablero de tareas por estado y por área, con vencidas marcadas
- [ ] **TSK-12**: El vecino recibe (opcionalmente) un aviso por WhatsApp cuando su tarea se resuelve

### Trazabilidad (AUD)

- [ ] **AUD-01**: Toda transición de conversación y de tarea se ejecuta en una función de base de datos atómica (estado esperado + bloqueo de fila + historial en la misma transacción)
- [ ] **AUD-02**: El historial de tareas, eventos de conversación y registro de actividad son append-only (sin update ni delete desde el cliente)
- [ ] **AUD-03**: Los cierres, cancelaciones y delegaciones externas generan una nota de auditoría sellada (hash) e idempotente por correlation-id
- [ ] **AUD-04**: Operador puede exportar la trazabilidad completa de un caso (conversación + tareas + eventos) como informe

### Chatbot LLM (BOT)

- [ ] **BOT-01**: Admin puede cargar documentos oficiales (PDF, texto, FAQs, horarios) a la base de conocimiento y reindexarlos
- [ ] **BOT-02**: El bot responde consultas usando solo la base de conocimiento (RAG) y cita la fuente
- [ ] **BOT-03**: Cuando la confianza es baja, el tema es sensible o el vecino pide hablar con una persona, el bot deriva a la cola y registra el motivo
- [ ] **BOT-04**: El bot queda pausado en una conversación mientras tenga dueño humano y se reactiva al resolverla
- [ ] **BOT-05**: Admin puede pausar el bot globalmente (y existe un apagado de emergencia por variable de entorno)
- [ ] **BOT-06**: El bot clasifica cada caso (tema, área sugerida, urgencia) para prellenar la derivación y la tarea
- [ ] **BOT-07**: El bot extrae datos del vecino desde la charla (nombre, DNI, domicilio), pide confirmación y los guarda con origen "bot"
- [ ] **BOT-08**: El bot lee imágenes y PDFs enviados por el vecino y deja un resumen como nota en la conversación
- [ ] **BOT-09**: El bot transcribe audios entrantes y los usa como texto de la consulta
- [ ] **BOT-10**: El bot puede enviar archivos oficiales (formularios, requisitos) cuando corresponde
- [ ] **BOT-11**: Fuera del horario de atención el bot informa horarios y deja el caso en cola
- [ ] **BOT-12**: En el primer contacto el bot envía el aviso de privacidad (Ley 25.326)
- [ ] **BOT-13**: Cada respuesta del bot queda registrada con fuentes usadas y confianza, visible para el operador

### Operación y métricas (OPS)

- [ ] **OPS-01**: Admin ve un panel con mensajes sin responder, conversaciones abiertas, pobladores registrados / no registrados y tareas abiertas / vencidas por área
- [ ] **OPS-02**: Admin ve métricas del bot: porcentaje resuelto sin humano, derivaciones por motivo, temas más consultados
- [ ] **OPS-03**: Admin ve tiempo de primera respuesta y cumplimiento de SLA por área y por operador
- [ ] **OPS-04**: El proyecto tiene CI que corre lint, typecheck y tests en cada push
- [ ] **OPS-05**: Existe un runbook de despliegue de Evolution API y del panel, con backups de base de datos

## v2 Requirements

Diferidos. Se trackean pero no entran al roadmap actual.

### Participación ciudadana

- **V2-01**: Encuesta de satisfacción al cerrar la conversación
- **V2-02**: Avisos masivos municipales (cortes, vencimientos de tasas) con pausas anti-bloqueo y listas por barrio/paraje

### Datos

- **V2-03**: Importación de un padrón existente desde Excel/CSV con vista previa y resolución de conflictos por DNI/teléfono
- **V2-04**: Política de retención y anonimización automática de datos personales

### Equipo

- **V2-05**: Puntaje / gamificación de operadores (claim, resolución, primera respuesta)
- **V2-06**: Agenda/calendario de tareas por vencimiento

### Canal

- **V2-07**: Meta Cloud API como transporte alternativo (plantillas HSM, ventana 24 h)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fine-tuning de modelo | RAG es actualizable subiendo documentos; menor costo y riesgo |
| Expediente digital / firma / GDE | El sistema orienta, recibe y deriva; no reemplaza el circuito administrativo |
| App móvil nativa | Vecinos usan WhatsApp; operadores usan panel web responsive |
| Grupos de WhatsApp | Solo chats directos; grupos y difusiones se ignoran |
| Todo lo de seguros del CRM de referencia | Pólizas, cupones, scrapers, portal Rivadavia, cotizaciones no aplican |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01, FND-07, FND-08 | Phase 1 (`foundation-workspace-auth`) | Implemented — pending review/archive |
| FND-06 | Phase 1 (`foundation-workspace-auth` org level; `areas-operators-admin` area level) | Partial |
| FND-02..05 | Phase 1 (`areas-operators-admin`) | Pending |
| WA-01..12 | Phase 2 | Pending |
| INB-01..15 | Phase 3 | Pending |
| POB-01..09 | Phase 4 | Pending |
| TSK-01..12 | Phase 5 | Pending |
| AUD-01..04 | Phase 5 | Pending |
| BOT-01..13 | Phase 6 | Pending |
| OPS-01..05 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 78 total
- Mapped to phases: 78
- Unmapped: 0

---
*Requirements defined: 2026-09-30*
*Last updated: 2026-10-01 after implementing `foundation-workspace-auth`*
