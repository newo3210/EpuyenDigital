# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-09-30
**Change relacionado:** ninguno todavía — línea base del diseño al instalar SDD (no hay código)

---

## 1. Resumen de la decisión

Vamos a construir la mesa de entrada digital del Municipio de Epuyén: un panel web donde llegan los WhatsApp de los vecinos, un bot con IA responde con información oficial y, cuando no sabe, pasa la conversación a una cola de operadores. Desde ahí se toman, se delegan a otras áreas y se convierten en tareas cuyo final queda registrado. El problema de negocio: que ningún mensaje quede sin respuesta ni sin responsable, y que se pueda reconstruir quién hizo qué.

Decidimos **arrancar limpio** en lugar de copiar el CRM de seguros, y documentar todo antes de escribir código.

## 2. Mapa de flujo de datos

```text
Vecino (WhatsApp)
  → Evolution API (mantiene la sesión de WhatsApp)
    → Webhook del panel (capa de presentación, delgada)
      → Servicio de mensajería (capa de aplicación)
        → Repositorios (infraestructura) → Postgres en Supabase
        → Tabla de trabajos (jobs)
          → Worker: servicio del bot (aplicación) → LLM + búsqueda en documentos oficiales
            → Respuesta al vecino  o  derivación a la cola de operadores
```

- **Webhook → servicio**: viaja el JSON de Evolution. Lo valida un schema Zod y el secreto de la línea; si no coincide, se rechaza.
- **Servicio → repositorio**: viajan objetos del dominio (poblador, conversación, mensaje). El servicio decide; el repositorio solo guarda.
- **Repositorio → base**: la base asegura que no haya mensajes duplicados (clave única por id externo) y que cada operador vea solo sus áreas (RLS).
- **Worker → LLM**: viaja la pregunta más los fragmentos de documentos oficiales. Vuelve un JSON que valida Zod.

## 3. Justificación de Clean Architecture

- Si el bot viviera dentro de un componente de React o dentro del webhook, un LLM lento haría que Evolution reintentara el mensaje y se duplicaran respuestas. Por eso el webhook solo guarda y encola, y el bot corre en el worker.
- Separar repositorios permite testear los servicios con repositorios falsos en memoria, y cambiar de proveedor de LLM sin tocar la lógica.
- **Excepción consciente**: tomar, delegar, aceptar o resolver se hacen en funciones SQL. Si dos operadores apretan "tomar" al mismo tiempo, solo la base puede garantizar que gane uno (bloqueo de fila en una transacción).

## 4. Control de salida (anti-alucinación)

- El LLM devuelve siempre un JSON validado con Zod (decisión, respuesta, fuentes, confianza, motivo de derivación).
- Si el JSON no cumple el schema: se reintenta una vez y, si vuelve a fallar, la conversación pasa a un humano con motivo "error".
- El bot solo puede responder si encontró fragmentos oficiales con confianza suficiente; si no, deriva. Un DNI detectado en la charla solo se guarda si el vecino lo confirma.

## 5. Glosario técnico

| Concepto | Qué significa aquí | Dónde aparece en el código |
|---|---|---|
| Webhook | Dirección del panel a la que Evolution avisa cada mensaje nuevo | `apps/web/src/app/api/webhooks/evolution` (planeado) |
| RLS (Row Level Security) | Reglas de la base que filtran qué filas ve cada operador según su municipio y área | `supabase/migrations` (planeado) |
| RAG | El bot busca primero en los documentos oficiales y responde solo con eso | `worker/src/features/bot` (planeado) |
| Transacción atómica | Varias escrituras que pasan todas juntas o ninguna (ej. tomar la conversación + registrar el evento) | Funciones SQL en `supabase/migrations` (planeado) |

## 6. Qué aprendí / qué defendería en una oral

- Por qué no copiar el CRM: tenía fallas reales (el bot pisaba al operador, se perdían las fotos de los vecinos, el historial se podía borrar). Portar pieza por pieza obliga a corregirlas.
- Por qué el webhook no llama al LLM: velocidad y reintentos de Evolution.
- Por qué la base de datos es dueña de los estados: concurrencia entre operadores.
- Por qué documentar primero: 78 requisitos con ID y 7 fases permiten verificar cada entrega contra algo escrito.

## 7. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| 2026-09-30 | — (bootstrap SDD) | Línea base: flujo planeado, justificación de capas, control de salida, glosario |
