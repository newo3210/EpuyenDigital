# Documentación — Mesa de Entrada Digital Epuyén

Panel de mensajería WhatsApp (Evolution API) con chatbot LLM, cola de triage, base de pobladores y tareas delegables con trazabilidad, para la mesa de entrada del Municipio de Epuyén.

## Índice

| Documento | Para qué sirve |
|---|---|
| [architecture.md](architecture.md) | Componentes, principios, estructura del repo, seguridad, entornos y decisiones abiertas |
| [data-model.md](data-model.md) | Tablas, columnas clave, enums, reglas de acceso (RLS) y funciones SQL |
| [flows.md](flows.md) | Mensaje entrante, decisión del bot, estados de conversación, delegación, tareas, contactos externos, registro progresivo |
| [reuse-from-seguros.md](reuse-from-seguros.md) | Qué se porta del CRM de seguros, desde qué archivo, en qué fase y con qué corrección |

## Estándares y proceso (SDD / OpenSpec)

| Documento | Para qué sirve |
|---|---|
| [base-standards.md](base-standards.md) | Reglas para todos los agentes: TDD, idioma, capas con rutas concretas, entorno local, jerarquía GSD + OpenSpec |
| [backend-standards.md](backend-standards.md) | Supabase, funciones SQL, RLS, webhook, worker, Evolution, LLM, tests |
| [frontend-standards.md](frontend-standards.md) | Next.js, componentes, realtime, UI/UX, accesibilidad |
| [openspec-tasks-mandatory-steps.md](openspec-tasks-mandatory-steps.md) | Checklist obligatorio de cada `tasks.md` |
| [documentation-standards.md](documentation-standards.md) | Cómo se mantiene la documentación |
| [como-incorporar-openspec-a-cursor.md](como-incorporar-openspec-a-cursor.md) | Guía del flujo OpenSpec en Cursor (`/director`, `/opsx:*`) |

Documentos raíz obligatorios (se actualizan en cada cambio): [../ARCHITECTURE_SDD.md](../ARCHITECTURE_SDD.md) (inglés) y [../STUDENT_DECISION_LOG.md](../STUDENT_DECISION_LOG.md) (español).

## Planificación (GSD)

| Archivo | Contenido |
|---|---|
| [../.planning/PROJECT.md](../.planning/PROJECT.md) | Qué es, valor central, alcance, restricciones, decisiones |
| [../.planning/REQUIREMENTS.md](../.planning/REQUIREMENTS.md) | 78 requisitos v1 con IDs + v2 diferidos |
| [../.planning/ROADMAP.md](../.planning/ROADMAP.md) | 7 fases con criterios de éxito |
| [../.planning/STATE.md](../.planning/STATE.md) | Dónde estamos y próximos pasos |

## Glosario

- **Poblador / vecino**: persona que escribe por WhatsApp. Puede estar *no registrado* (solo teléfono) o *registrado* (nombre + DNI + teléfono).
- **Línea**: número de WhatsApp municipal conectado a una instancia de Evolution API.
- **Área**: dependencia municipal (Mesa de Entrada, Obras, Acción Social…). Toda conversación y tarea pertenece a un área.
- **Cola**: conversaciones abiertas de un área; las sin dueño primero, en orden de llegada (FIFO).
- **Claim / tomar**: un operador se hace dueño de una conversación o tarea.
- **Delegación con aceptación (soft handoff)**: se pasa una conversación o tarea a otra persona o área, que debe aceptarla o rechazarla; si rechaza, vuelve a quien la mandó.
- **Contacto externo**: responsable que no usa el panel y recibe/cierra tareas respondiendo por WhatsApp.
- **Handoff del bot**: el bot deja de atender y pasa la conversación a la cola, con motivo.
- **Resultado (outcome)**: cómo terminó una tarea — resuelta, abandonada, derivada fuera del municipio, sin respuesta del vecino, duplicada.
