# Acceptance matrix — tareas-notas-trazabilidad

| Spec / requirement | Evidence | Status |
|---|---|---|
| Tables + definer transitions + revoke authenticated writes | migration + Vitest SQL contract | PASS (static) |
| Claim conflict / cancel reason / seal immutability | `009_tasks_notes.test.sql` | GAP (NO_DOCKER) |
| External phone skips citizen stub + pet job | inbound unit test | PASS |
| External command protocol | SQL `apply_external_task_command` + shared parser + worker notify test | PASS (unit) |
| Task board filters + overdue | `list_tasks` + `/tasks` UI | PASS (code) |
| Create task from thread | `CreateTaskForm` on inbox thread | PASS (code) |
| Notes + convert + seal | notes panel + SQL seal trigger | PASS (code / static) |
| External contacts admin | `/settings/external-contacts` | PASS (code) |
| Case export download | `ExportCaseButton` + `export_case` | PASS (code) |
| Timeline/merge include notes & tasks | migration rewrite + citizens repository | PASS (code / static) |
| Support read-only | pages gate `canMutate` | PASS (code) |
| No BOT LLM / OPS / WA-08 / WA-11 | tasks.md 6.x checked; not implemented | PASS |
| Live curl / browser | reports 5.3 / 5.4 | GAP (NO_DOCKER) |
