# Roadmap: Mesa de Entrada Digital — Municipio de Epuyén

## Overview

Se construye de abajo hacia arriba: primero la base (auth, roles, áreas, Supabase), después el canal WhatsApp completo con Evolution (entrada con adjuntos y salida segura), luego el panel de mensajería con la cola de triage, la base de pobladores, las tareas/notas delegables con trazabilidad inmutable, y recién entonces el chatbot LLM — cuando ya existe una cola confiable a la cual derivar. Cierra con métricas, CI y runbooks de operación. Cada fase porta piezas del CRM de referencia (`docs/reuse-from-seguros.md`) corrigiendo sus huecos.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Fundación** - Repo, Supabase, auth, roles, áreas, RLS por organización y área, registro de errores
- [ ] **Phase 2: Canal WhatsApp** - Evolution API: webhook seguro, entrada con adjuntos, salida multimedia, modo de envío seguro
- [ ] **Phase 3: Panel de mensajería** - Cola de triage FIFO, claim, delegación con aceptación, eventos, tiempo real, flags
- [ ] **Phase 4: Pobladores** - Registro automático, ficha editable, registro progresivo, timeline, duplicados
- [ ] **Phase 5: Tareas, notas y trazabilidad** - Tareas delegables a áreas y números externos, resultado de cierre, auditoría atómica
- [ ] **Phase 6: Chatbot LLM** - RAG sobre documentación oficial, derivación, pausa por conversación, lectura de documentos y audios
- [ ] **Phase 7: Operación y métricas** - Panel de métricas, CI, runbooks de despliegue y backups

## Phase Details

### Phase 1: Fundación
**Goal**: Un admin puede entrar al panel, crear áreas y operadores con roles, y la base de datos garantiza aislamiento por organización y área.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, FND-07, FND-08
**Success Criteria** (what must be TRUE):
  1. Un operador inicia sesión y la sesión persiste; sin sesión, toda ruta redirige a login
  2. El admin crea un área y un operador asignado a ella; el operador solo ve datos de su área
  3. El admin cambia el rol de un operador y lo desactiva; el desactivado no puede entrar
  4. Un test de RLS demuestra que dos organizaciones no ven datos cruzados
  5. Un error forzado aparece en la pantalla de soporte con trace-id y datos personales enmascarados
**Plans**: TBD

### Phase 2: Canal WhatsApp
**Goal**: Los mensajes de los vecinos (texto y adjuntos) entran de forma segura e idempotente, y el sistema puede responder con texto, imagen, documento y audio respetando el modo de envío.
**Depends on**: Phase 1
**Requirements**: WA-01, WA-02, WA-03, WA-04, WA-05, WA-06, WA-07, WA-08, WA-09, WA-10, WA-11, WA-12
**Success Criteria** (what must be TRUE):
  1. El admin configura una línea Evolution, prueba la conexión y ve "conectada"
  2. Una llamada al webhook sin secreto válido es rechazada; con secreto, el mensaje se guarda una sola vez aunque llegue repetido
  3. Una foto, un audio y un PDF enviados por un vecino quedan guardados en Storage y asociados a su conversación
  4. En modo `allowlist`, un envío a un número fuera de la lista se bloquea y queda registrado
  5. Un mensaje escrito desde el teléfono de la línea aparece como saliente en la conversación
**Plans**: TBD

### Phase 3: Panel de mensajería
**Goal**: Los operadores atienden una cola donde nada queda sin dueño: toman, responden, delegan con aceptación y resuelven, viendo todo en tiempo real.
**Depends on**: Phase 2
**Requirements**: INB-01, INB-02, INB-03, INB-04, INB-05, INB-06, INB-07, INB-08, INB-09, INB-10, INB-11, INB-12, INB-13, INB-14, INB-15
**Success Criteria** (what must be TRUE):
  1. Dos conversaciones sin dueño aparecen arriba de todo, la más antigua primero
  2. Dos operadores intentan tomar la misma conversación a la vez: uno gana y el otro recibe aviso de conflicto
  3. Un operador delega a otra área con nota; el destinatario la rechaza y la conversación vuelve al emisor, todo visible en la línea de eventos
  4. Un vecino escribe sobre una conversación resuelta y reaparece en la cola sin recargar la página
  5. Las tarjetas muestran fecha/hora, registrado/no registrado, dueño, área, SLA y bot activo/pausado
**Plans**: TBD
**UI hint**: yes

### Phase 4: Pobladores
**Goal**: Cada vecino que escribe tiene una ficha que el operador puede completar desde el chat, que crece con el uso y que muestra toda su historia.
**Depends on**: Phase 3
**Requirements**: POB-01, POB-02, POB-03, POB-04, POB-05, POB-06, POB-07, POB-08, POB-09
**Success Criteria** (what must be TRUE):
  1. Un número nuevo que escribe aparece como poblador "no registrado" con su pushName y foto
  2. El operador completa nombre + DNI desde el chat y lo marca "registrado"; la tarjeta de la cola cambia de flag
  3. Un dato corregido a mano no se pisa cuando llega otro valor desde el bot
  4. La ficha muestra mensajes, eventos, notas y tareas en un solo timeline
  5. Dos pobladores duplicados se unifican y el historial de ambos queda en uno
**Plans**: TBD
**UI hint**: yes

### Phase 5: Tareas, notas y trazabilidad
**Goal**: Cada conversación puede generar tareas y notas delegables a áreas o números WhatsApp externos, y cada movimiento queda registrado de forma inmutable con su resultado final.
**Depends on**: Phase 4
**Requirements**: TSK-01, TSK-02, TSK-03, TSK-04, TSK-05, TSK-06, TSK-07, TSK-08, TSK-09, TSK-10, TSK-11, TSK-12, AUD-01, AUD-02, AUD-03, AUD-04
**Success Criteria** (what must be TRUE):
  1. Desde un chat se crea una tarea en un clic, queda en la bolsa de un área y un miembro del área la toma
  2. Una tarea delegada a un número externo se acepta y se cierra respondiendo por WhatsApp, y el historial lo registra
  3. Al cerrar una tarea queda registrado el resultado y quién la resolvió; cancelar sin motivo no es posible
  4. Una tarea sin actividad por N días pasa sola a "abandonada"
  5. Intentar borrar o editar historial desde el cliente falla; el informe exportado de un caso muestra la cadena completa
**Plans**: TBD
**UI hint**: yes

### Phase 6: Chatbot LLM
**Goal**: El bot responde con información oficial citando fuentes, clasifica y deriva a la cola cuando no sabe, se aparta cuando un humano toma el chat, y entiende fotos, PDFs y audios.
**Depends on**: Phase 5
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, BOT-05, BOT-06, BOT-07, BOT-08, BOT-09, BOT-10, BOT-11, BOT-12, BOT-13
**Success Criteria** (what must be TRUE):
  1. El admin sube un PDF de requisitos y el bot responde una pregunta sobre él citando el documento
  2. Una pregunta fuera de la base hace que el bot derive a la cola con motivo "baja confianza" y área sugerida
  3. Con la conversación tomada por un operador, el bot no responde ningún mensaje del vecino hasta que se resuelve
  4. Un audio del vecino se transcribe y un PDF se resume como nota en la conversación
  5. El bot pide confirmación antes de guardar el DNI extraído de la charla en la ficha
**Plans**: TBD

### Phase 7: Operación y métricas
**Goal**: El municipio puede medir la atención (humana y del bot) y operar el sistema con CI, despliegue documentado y backups.
**Depends on**: Phase 6
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05
**Success Criteria** (what must be TRUE):
  1. El admin ve sin responder, abiertas, registrados/no registrados y tareas vencidas por área
  2. El admin ve el porcentaje de consultas resueltas por el bot sin humano y los motivos de derivación
  3. Cada push corre lint, typecheck y tests en CI
  4. Siguiendo el runbook, alguien sin contexto levanta Evolution + panel y restaura un backup
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundación | 0/TBD | Not started | - |
| 2. Canal WhatsApp | 0/TBD | Not started | - |
| 3. Panel de mensajería | 0/TBD | Not started | - |
| 4. Pobladores | 0/TBD | Not started | - |
| 5. Tareas, notas y trazabilidad | 0/TBD | Not started | - |
| 6. Chatbot LLM | 0/TBD | Not started | - |
| 7. Operación y métricas | 0/TBD | Not started | - |
