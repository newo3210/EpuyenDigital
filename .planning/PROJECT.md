# Mesa de Entrada Digital — Municipio de Epuyén

## What This Is

Panel web de mensajería para la mesa de entrada del Municipio de Epuyén (Chubut). Los vecinos escriben por WhatsApp (vía Evolution API), un chatbot con LLM responde con información oficial, y los operadores municipales atienden una cola de triage donde toman conversaciones, las delegan a otras áreas o números de WhatsApp, y generan tareas y notas cuyo ciclo de vida queda trazado (quién la tomó, quién la resolvió, si se abandonó). Cada contacto actualiza una base de pobladores que crece con el uso.

## Core Value

Ningún mensaje de un vecino queda sin respuesta ni sin dueño: o lo resuelve el bot con información oficial, o entra a una cola visible donde un humano lo toma, lo deriva y lo cierra con trazabilidad completa.

## Requirements

### Validated

(None yet — ship to validate)

### Active

Ver `.planning/REQUIREMENTS.md` para el detalle con IDs. Resumen:

- [ ] Canal WhatsApp con Evolution API: entrada segura (texto + adjuntos), salida (texto, imagen, documento, audio), modo de envío seguro
- [ ] Panel de mensajería: cola sin-dueño-primero FIFO, claim, delegación con aceptación, soft handoff, eventos, tiempo real
- [ ] Base de pobladores: registrado / no registrado, ficha editable, registro progresivo, timeline
- [ ] Tareas y notas desde conversaciones, delegables a áreas o números WhatsApp externos, con resultado de cierre
- [ ] Trazabilidad inmutable de cada movimiento (quién, qué, cuándo)
- [ ] Chatbot LLM con RAG sobre documentación oficial; deriva a humano cuando no sabe; se pausa cuando un humano toma el chat
- [ ] Operadores con roles y áreas; visibilidad por área
- [ ] Métricas operativas y del bot

### Out of Scope

- Fine-tuning / modelo propio — RAG sobre documentos oficiales es actualizable y barato
- Expediente digital / firma electrónica / GDE — el sistema orienta, recibe y deriva; no reemplaza el circuito administrativo
- App móvil nativa — el canal ciudadano es WhatsApp; el panel es web responsive
- Meta Cloud API en v1 — Evolution API es el transporte; el router queda preparado para sumar Meta después
- Todo lo específico de seguros del CRM de referencia (pólizas, cupones, scrapers, portal Rivadavia, cotizaciones)

## Context

- **Origen:** retoma la idea del bot de mesa de entrada (kickoff 2026-09-08) como proyecto nuevo, tomando como referencia funcional el CRM de seguros `newo3210/seguros` (privado), que ya resolvió Evolution API, cola de triage con claim/delegación/aceptación, eventos de conversación, tareas con historial y auditoría sellada.
- **Estrategia:** arrancar limpio (repo nuevo) y portar pieza por pieza desde el CRM, corrigiendo los huecos detectados. Mapa en `docs/reuse-from-seguros.md`.
- **Huecos del CRM que NO se heredan:** adjuntos entrantes descartados; bot que vuelve al menú cuando responde un humano; webhook Evolution abierto si no hay secreto; no existe "área"; transiciones de tareas no atómicas; historial borrable desde el cliente; consultas O(n) sobre clientes y mensajes.
- **Usuarios:** vecinos de Epuyén y parajes (canal WhatsApp); operadores de mesa de entrada; responsables de áreas municipales (algunos sin usar el panel, solo WhatsApp); administrador del sistema.
- **Documentación de diseño:** `docs/architecture.md`, `docs/data-model.md`, `docs/flows.md`.

## Constraints

- **Transporte**: Evolution API v2 (Baileys) — decisión tomada; instancias autoalojadas
- **Stack**: Next.js 15 + React 19 + TypeScript + Supabase (Postgres, Auth, Realtime, Storage, pgvector) — mismo stack que el CRM de referencia para portar sin fricción
- **Conocimiento del bot**: solo información oficial cargada en la base; ante duda → humano, nunca inventar trámites ni normativa
- **Privacidad**: datos personales de vecinos (DNI, domicilio, documentos) bajo Ley 25.326 — aviso de privacidad, enmascarado en logs, acceso por rol/área, retención definida
- **Integridad**: historial y auditoría append-only; transiciones de estado atómicas en base de datos
- **Idioma**: interfaz y bot en español rioplatense (es-AR); artefactos técnicos (código, esquemas) en inglés

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Arrancar limpio y documentar primero | Evitar heredar deuda de seguros; portar piezas con criterio | — Pending |
| Evolution API como único transporte v1 | Sin dependencia de aprobación Meta; ya probado en el CRM | — Pending |
| El panel es el producto (no "WhatsApp primero") | La operación municipal necesita cola, dueño y trazabilidad desde el día 1 | — Pending |
| Tabla única `citizens` con estado de registro | Reemplaza la dupla clients/potential_clients del CRM; más simple | — Pending |
| Áreas como entidad de primera clase | Delegación y visibilidad municipal son por área, no solo por persona | — Pending |
| Delegación a números WhatsApp externos | Responsables de área que no usan el panel igual reciben y cierran tareas | — Pending |
| Bot pausado por conversación mientras tenga dueño humano | Corrige el bug del CRM donde el bot pisaba al operador | — Pending |
| RAG con pgvector en Supabase | Un solo proveedor de datos; actualizable subiendo documentos | — Pending |
| Proveedor LLM | A definir en la fase del bot (costo, latencia, calidad en es-AR) | — Pending |
| Hosting | A definir: panel en Vercel/VPS; Evolution en servidor municipal o VPS | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-30 after restart as new project (documentation-first)*
