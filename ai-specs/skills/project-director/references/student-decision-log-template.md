# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).  
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.  
> Copiá esta plantilla en la primera feature; actualizala cada vez que cierres un módulo o change OpenSpec.

**Última actualización:** YYYY-MM-DD  
**Change relacionado:** `openspec/changes/<change-name>/`

---

## 1. Resumen de la decisión

En 2–4 frases: qué se construyó, para quién, y cuál fue el problema de negocio o de aprendizaje que resolviste.

## 2. Mapa de flujo de datos

Describí el recorrido paso a paso (adaptá los nombres de carpeta a **este** proyecto):

```text
Frontend / UI
  → API / capa de presentación (HTTP delgado)
    → Service / capa de aplicación (negocio o IA)
      → Modelo / LLM o dominio (si aplica)
        → Repository / infraestructura
          → Base de datos / almacenamiento
```

Para cada flecha, explicá **qué dato viaja** y **quién lo valida**.

## 3. Justificación de Clean Architecture

Por qué dividiste el código entre capas (presentación, servicios/aplicación, repositorios/infraestructura, contratos):

- ¿Qué se rompería si mezclaras lógica de negocio o de IA en un componente de UI o en una ruta HTTP?
- ¿Cómo ayuda esta separación a testear o a cambiar de proveedor (DB, LLM) sin reescribir todo?

## 4. Control de salida (anti-alucinación)

Cómo usaste Zod (u otro schema) para forzar tipos y JSON válidos:

- En qué frontera (API request/response, salida del LLM, etc.)
- Qué pasa si el modelo o el cliente no cumplen el schema
- Un ejemplo concreto de este proyecto (nombre del schema + campo crítico)

## 5. Glosario técnico (3–4 conceptos)

Explicá de forma simple, **en el contexto de este proyecto**:

| Concepto | Qué significa aquí | Dónde aparece en el código |
|---|---|---|
| Ej. Async/Await | | |
| Ej. Streams | | |
| Ej. Embeddings | | |
| Ej. Repository | | |

## 6. Qué aprendí / qué defendería en una oral

Bullet points honestos: trade-offs, errores evitados, y lo que mostrarías primero a un evaluador.

## 7. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| YYYY-MM-DD | `<change-name>` | Resumen breve |
