# Bitácora de decisiones del estudiante

> **Idioma:** Español (pedagógico).
> **Ubicación:** raíz del repo `STUDENT_DECISION_LOG.md`.
> Se actualiza cada vez que se cierra un módulo o un cambio de OpenSpec.

**Última actualización:** 2026-10-05
**Change relacionado:** `openspec/changes/foundation-workspace-auth/` (Fase 1, cambio 1 de 2)

---

## 1. Resumen de la decisión

Vamos a construir la mesa de entrada digital del Municipio de Epuyén: un panel web donde llegan los WhatsApp de los vecinos, un bot con IA responde con información oficial y, cuando no sabe, pasa la conversación a una cola de operadores. Desde ahí se toman, se delegan a otras áreas y se convierten en tareas cuyo final queda registrado. El problema de negocio: que ningún mensaje quede sin respuesta ni sin responsable, y que se pueda reconstruir quién hizo qué.

Decidimos **arrancar limpio** en lugar de copiar el CRM de seguros, y documentar todo antes de escribir código.

**Lo que ya está construido (cimientos):** el proyecto arranca con un comando, la base corre en la máquina local (Podman), cada operador entra con email y contraseña, ve solo los datos de su municipio, puede cambiar su nombre y su foto, y cualquier error queda registrado sin datos personales para que soporte lo revise y lo marque como resuelto.

## 2. Mapa de flujo de datos

### 2.1 Lo que ya funciona: entrar al panel

```text
Operador escribe email + contraseña en /login
  → Formulario (presentación): valida formato con un schema Zod antes de enviar
  → Server action signInAction (presentación delgada)
    → Caso de uso signIn (aplicación): vuelve a validar, llama a Supabase Auth
      → Supabase Auth (infraestructura) → cookie de sesión
  → Redirección a la página pedida (solo rutas internas, nunca a otro sitio)

Cada pedido al panel
  → middleware: le pone un número de rastreo (trace id) y refresca la sesión
  → layout del panel: busca el perfil del operador
     sin perfil o desactivado → lo saca y lo manda a /login con el motivo
  → la base (RLS) filtra todas las lecturas por su municipio
```

- **Formulario → server action**: viajan email y contraseña. Si la contraseña es incorrecta el mensaje es genérico ("Email o contraseña incorrectos.") para no revelar qué emails existen.
- **Caso de uso → repositorio**: viaja el id del usuario; vuelve un perfil validado con Zod (nombre, rol, municipio, si está activo).
- **Repositorio → base**: la base decide qué filas devolver según quién pregunta. Aunque la aplicación tuviera un error, un operador nunca recibe datos de otro municipio.

### 2.2 Lo que ya funciona: un error

```text
Algo falla en el servidor → instrumentation.ts lo captura
Algo falla en la pantalla → error.tsx muestra "Ocurrió un error. Código: XXXXXXXX"
                            y envía un reporte a POST /api/errors/report
                            (primero sesión, después un conteo previo barato, después cuerpo ≤ 16 KB)
  → se anota el municipio y el operador que estaba conectado (si lo hay)
  → redactar: se borran emails, DNI, CUIT, teléfonos, tokens y contraseñas
  → error_logs (solo el servidor puede escribir; los reportes de pantalla pasan por
    la función insert_client_error_report, que cuenta y guarda en una sola transacción:
    nunca más de 10 por minuto por usuario)
Soporte → /support/errors → filtra, abre el detalle, marca "resuelto"
  → la base anota quién lo resolvió y cuándo
```

### 2.3 Lo planeado (fases 2 a 7)

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
- **Worker → LLM**: viaja la pregunta más los fragmentos de documentos oficiales. Vuelve un JSON que valida Zod.

## 3. Justificación de Clean Architecture

- **Casos de uso con "puertos" inyectados.** `signIn`, `updateName`, `uploadAvatar`, `reportError`, `logError` reciben como parámetros las funciones que hablan con Supabase. Así los tests unitarios usan funciones falsas y prueban la lógica sin base ni Next. Los archivos `server.ts` y `actions.ts` son los únicos que conectan las piezas reales.
- **Repositorios como única puerta a Supabase.** Si mañana cambia una columna, se toca un archivo. Además validan cada fila con Zod: si la base devuelve algo raro, el error es claro (`profiles.invalid_row`) en lugar de una pantalla rota más adelante.
- **Por qué RLS con funciones auxiliares (`current_org_id()`, `current_user_role()`).** Las reglas de seguridad viven en la base, no en la aplicación. Las dos funciones devuelven "nada" si el perfil está desactivado, entonces **todas** las reglas dejan de coincidir de golpe: desactivar a alguien lo bloquea en todas las tablas sin tocar cada política. El CRM de seguros no tenía desactivación de usuarios; al portar sus helpers agregamos el chequeo de `is_active` adentro, sin ningún valor "por defecto" permisivo.
- **Triggers de guardia.** Un operador puede editar su propia fila de perfil, pero un trigger impide que cambie su rol, su municipio o su estado activo (error `forbidden_column`). Nadie desde la API, ni siquiera un admin, puede cambiar el `id` o la fecha de creación de un perfil: eso evitaría "reasignar" un perfil a otra cuenta.
- **Mínimo privilegio también en los permisos (`GRANT`).** RLS decide *qué filas*; los permisos deciden *qué operaciones*. El rol `authenticated` solo conserva `SELECT` y `UPDATE` en las tablas de negocio: crear o borrar perfiles queda para el service role. Postgres 17 agregó el permiso `MAINTAIN` (VACUUM, REINDEX, LOCK) y lo daba por defecto; la re-revisión lo encontró porque el test solo miraba la lista estándar de permisos, así que ahora se revoca y se prueba aparte. Los checks de la tabla (`profiles_full_name_trimmed_length`, `profiles_avatar_path_own_folder`) protegen el dato aunque alguien se salte la pantalla. En `error_logs`, otro trigger permite cambiar solo el estado y anota quién resolvió. La aplicación también controla roles, pero si alguien llama a la API directamente con su token, la base lo frena igual (lo probamos con curl).
- **`forbidden()` de Next para el 403.** Elegimos activar `experimental.authInterrupts` en lugar de redirigir con código 200: un operador que entra a `/support/errors` recibe un 403 real, que es lo correcto y se puede testear.
- **Excepción consciente (futura)**: tomar, delegar, aceptar o resolver se harán en funciones SQL. Si dos operadores aprietan "tomar" al mismo tiempo, solo la base puede garantizar que gane uno (bloqueo de fila en una transacción).

## 4. Control de salida (anti-alucinación y datos personales)

### 4.1 Redacción de datos personales en errores (ya implementado)

- Antes de guardar un error se pasa por `redactText` / `redactDetails` (`packages/shared/src/redact.ts`). Primero se borran secretos (cabeceras de autorización, cookies, tokens JWT, `password=...`), después datos personales: email → `[email]`, CUIT → `[cuit]`, teléfono → `[phone]`, DNI → `[dni]`.
- Los objetos se recorren hasta 5 niveles; claves como `password`, `token` o `cookie` se reemplazan enteras; si el detalle supera 8 KB se recorta.
- `logError` **nunca** lanza una excepción: si la base falla, escribe en consola (también redactado). Un error al registrar errores no puede tumbar la pantalla.
- **Lección aprendida en la prueba E2E:** Next identifica cada error del servidor con un "digest" numérico largo. Nuestra redacción lo confundía con un teléfono y lo guardaba como `[phone]`, así que no se podía unir el reporte de la pantalla con el del servidor. La solución, primero en la spec y después en código con TDD, fue guardar `digestRef`: un resumen SHA-256 de 16 caracteres escrito solo con letras (a–p). No tiene dígitos, así que la redacción no lo toca, y no expone el digest original. Moraleja: los filtros de privacidad deben probarse con datos reales del sistema, no solo con ejemplos inventados.
- **Lección de la revisión adversarial (2026-10-05):** la primera versión de la redacción fallaba de dos formas. (1) No reconocía formatos argentinos reales, como `(0294) 15-412-3456`, `+54 9 294 …` o un DNI con espacios, ni secretos en JSON como `"password":"…"`. (2) Algunas expresiones regulares tardaban **minutos** con un texto de 200 KB armado a propósito (*backtracking* cuadrático), y eso se puede usar para colgar el servidor. La solución (decisión D11) fue limitar la entrada a 16 384 caracteres y poner un tope a cada repetición de las regex, para que el tiempo crezca en forma lineal. Hoy hay un test que exige menos de 200 ms con 200 KB. Moraleja: un filtro de seguridad también es una superficie de ataque.
- **Lección de la re-revisión (decisión D12):** al reescribir la redacción se rompieron casos que antes andaban: secretos entre comillas (`password="…"`) y DNI pegados a letras o guiones bajos (`dni_30123456`). Arreglar un filtro puede empeorar otro caso. Por eso fijamos una regla: la nueva redacción tiene que tapar **todo** lo que tapaba la versión anterior (`65eb994`) más los casos nuevos, y los tests de regresión se corrieron contra las dos versiones para demostrarlo.
- El trace id viaja en la cabecera `x-trace-id` y en el cuerpo del reporte; si no coinciden, se rechaza (400).
- **El endpoint de reportes revisa en orden barato → caro:** primero la sesión (401), después un conteo previo de reportes recientes (429 sin leer el cuerpo) y recién entonces lee el cuerpo, cortándolo a los 16 KB (413). Así un atacante no puede obligar al servidor a leer megas.
- **El límite de 10 por minuto lo garantiza la base, no la aplicación.** La re-revisión rompió la primera versión de dos maneras. (1) Contaba las filas buscando `origin` *dentro* del JSON de detalles, y un reporte muy grande se recortaba y perdía esa marca, así que no contaba. (2) Si llegaban 50 pedidos al mismo tiempo, todos contaban "hay 0" antes de que nadie guardara, y entraban todos (condición de carrera). La solución: `origin` es ahora una columna propia, y la función SQL `insert_client_error_report` toma un candado por usuario (`pg_advisory_xact_lock`), cuenta y guarda dentro de la misma transacción. Lo probamos con 50 pedidos en paralelo: se guardaron exactamente 10. El conteo previo de la aplicación queda solo como atajo barato.
- **Login sin JavaScript:** si el formulario se envía antes de que la página termine de cargar, el navegador hace un POST al server action. Antes hacía un GET y la contraseña podía quedar en la URL y en el historial. Al usuario se le muestran solo los primeros 8 caracteres en mayúsculas como "código" para dictar por teléfono.

### 4.2 Bot (planeado, fase 6)

- El LLM devuelve siempre un JSON validado con Zod (decisión, respuesta, fuentes, confianza, motivo de derivación).
- Si el JSON no cumple el schema: se reintenta una vez y, si vuelve a fallar, la conversación pasa a un humano con motivo "error".
- El bot solo puede responder si encontró fragmentos oficiales con confianza suficiente; si no, deriva. Un DNI detectado en la charla solo se guarda si el vecino lo confirma.

## 5. Entorno local: Podman en lugar de la nube

- **Decisión:** Supabase corre en la máquina con Podman (no hay Docker instalado). Se hizo un spike con límite de 2 horas; funcionó en unos 25 minutos. Evidencia: `openspec/changes/foundation-workspace-auth/reports/2026-09-30-spike-supabase-podman.md`.
- **Problemas resueltos:** faltaba la carpeta `supabase/snippets/` (Studio la monta) y se apagaron `analytics` y `edge_runtime` para ahorrar memoria.
- **Por qué local:** las pruebas de seguridad (pgTAP) y los `db reset` son gratis e instantáneos, y no se arriesgan datos reales. El proyecto en la nube queda para `db push` y el despliegue.
- **Registro cerrado:** en `supabase/config.toml` se apagó el alta pública (`[auth] enable_signup = false`) y la contraseña mínima pasó a 10 caracteres. Trampa encontrada al verificar: `[auth.email] enable_signup` **no** significa "alta por email" sino "proveedor de email encendido"; si se apaga, nadie puede iniciar sesión (`email_provider_disabled`). Por eso queda en `true`.
- **Riesgo:** la máquina de Podman tiene 2 GiB y comparte memoria con otros contenedores; si aparece falta de memoria, se sube con `podman machine set --memory 4096`.

## 6. Glosario técnico

| Concepto | Qué significa aquí | Dónde aparece en el código |
|---|---|---|
| RLS (Row Level Security) | Reglas de la base que filtran qué filas ve cada operador según su municipio (y, en el próximo cambio, su área) | `supabase/migrations/20260930000100_foundation.sql` |
| Función `security definer` | Función SQL que corre con permisos del dueño; la usamos para leer el perfil propio sin que RLS se llame a sí misma en bucle | `current_org_id()`, `current_user_role()` en la migración |
| Trigger de guardia | Código en la base que se ejecuta antes de un UPDATE y rechaza cambios prohibidos | `profiles_guard_privileged_columns`, `error_logs_guard_update` |
| Middleware | Código que corre antes de cada página; refresca la sesión y pone el trace id | `apps/web/src/middleware.ts` |
| Server action | Función del servidor que un formulario llama directamente, sin escribir una API | `apps/web/src/features/*/actions.ts` |
| Trace id | Número único por pedido o error que permite encontrar el registro exacto | `packages/shared/src/trace.ts` |
| Redacción | Reemplazar datos personales y secretos por marcadores antes de guardar | `packages/shared/src/redact.ts` |
| digestRef | Huella del error de Next escrita solo con letras para unir reportes sin exponer datos | `apps/web/src/features/errors/digest-ref.ts` |
| Magic bytes | Primeros bytes de un archivo que dicen su tipo real (no confiamos en la extensión) | `apps/web/src/features/profile/sniff-image.ts` |
| pgTAP | Tests escritos en SQL que prueban las reglas de seguridad de la base | `supabase/tests/*.test.sql` |
| Webhook | Dirección del panel a la que Evolution avisa cada mensaje nuevo | `apps/web/src/app/api/webhooks/evolution` (planeado) |
| RAG | El bot busca primero en los documentos oficiales y responde solo con eso | `worker/src/features/bot` (planeado) |
| Transacción atómica | Varias escrituras que pasan todas juntas o ninguna | Funciones SQL (planeado) |
| ReDoS / backtracking | Una regex mal acotada puede tardar muchísimo con un texto armado a propósito y colgar el servidor | `packages/shared/src/redact.ts` (cuantificadores acotados) |
| Rate limit | Tope de pedidos por usuario en una ventana de tiempo (acá: 10 reportes por minuto) | `apps/web/src/features/errors/report-error.ts`, función `insert_client_error_report` |
| Condición de carrera | Dos pedidos simultáneos leen el mismo dato "viejo" y ambos actúan como si fueran los únicos | Resuelta con candado en `supabase/migrations/20261005000200_report_rate_limit.sql` |
| Advisory lock | Candado de Postgres con un nombre elegido por nosotros (acá, uno por usuario); se libera solo al terminar la transacción | `pg_advisory_xact_lock` en `insert_client_error_report` |
| Blancos Unicode | Caracteres que no se ven (tab, espacio duro NBSP, espacio de ancho cero, BOM); un nombre hecho solo de eso parece vacío | Check `profiles_full_name_trimmed_length` en `20261005000300_maintain_and_blank_names.sql` |
| GRANT / mínimo privilegio | Permisos por operación (leer, actualizar, borrar) que se suman a RLS | `supabase/migrations/20261005000100_foundation_hardening.sql` |
| Revisión adversarial | Un revisor independiente (otra sesión) intenta romper el cambio antes de cerrarlo | `openspec/changes/foundation-workspace-auth/reports/2026-10-05-adversarial-review.md` |

## 7. Qué aprendí / qué defendería en una oral

- Por qué no copiar el CRM: tenía fallas reales (el bot pisaba al operador, se perdían las fotos de los vecinos, el historial se podía borrar, no se podía desactivar a un usuario). Portar pieza por pieza obliga a corregirlas.
- Por qué la seguridad vive en la base: probamos con curl y el token de un operador que no puede leer errores ni cambiarse el rol, aunque se salte la pantalla.
- Por qué validar archivos por su contenido: un `.png` renombrado puede ser cualquier cosa; leemos los primeros bytes.
- Por qué el error tracking redacta: los mensajes de error suelen arrastrar lo que escribió el vecino (DNI, teléfono). Guardar eso en un log viola la privacidad.
- Por qué TDD: 248 tests unitarios y 69 tests de base dieron confianza para corregir el defecto del digest sin romper nada. Después de la revisión adversarial son 306 unitarios y 89 de base, y tras la re-revisión, 337 unitarios y 111 de base.
- Por qué "quien escribe no revisa": la verificación mecánica (`/opsx:verify`) dio todo en verde, pero un revisor independiente encontró 3 fallas mayores. Pasar los checks no significa que el código sea seguro. Y la segunda revisión encontró que el arreglo del límite se podía saltear: un test que corre de a un pedido no prueba lo que pasa con 50 a la vez.
- Por qué el webhook no llamará al LLM (fase 2): velocidad y reintentos de Evolution.
- Por qué documentar primero: 78 requisitos con ID y 7 fases permiten verificar cada entrega contra algo escrito.

## 8. Historial de entradas

| Fecha | Change | Qué se agregó a esta bitácora |
|---|---|---|
| 2026-09-30 | — (bootstrap SDD) | Línea base: flujo planeado, justificación de capas, control de salida, glosario |
| 2026-10-01 | `foundation-workspace-auth` | Flujo real de login y errores, RLS con funciones auxiliares, triggers de guardia, redacción y lección del digest, decisión Podman, glosario ampliado |
| 2026-10-05 | `foundation-workspace-auth` (endurecimiento) | Lecciones de la revisión adversarial: redacción lineal con formatos argentinos, endpoint de reportes barato → caro, login por POST, permisos mínimos, alta pública cerrada y la trampa de `auth.email.enable_signup` |
