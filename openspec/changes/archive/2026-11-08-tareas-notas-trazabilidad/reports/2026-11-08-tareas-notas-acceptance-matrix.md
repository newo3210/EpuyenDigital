# Acceptance matrix — tareas-notas-trazabilidad

| Spec / requirement | Evidence | Status |
|---|---|---|
| Tables + definer transitions + revoke authenticated writes | migration + Vitest SQL contract | PASS (static) |
| Claim conflict / cancel reason / seal immutability | `009_tasks_notes.test.sql` + seal trigger | GAP live (NO_DOCKER); static PASS |
| External phone skips citizen stub + pet job | inbound unit test | PASS |
| External command protocol | SQL without `(?i)`; shared parser + worker notify | PASS (static/unit); live GAP |
| Complete task + citizen notify | `chosen` outcome + jobs insert inside definer | PASS (static) |
| `inbox_raise` / conversation visibility NULL fix | patched in this migration | PASS (static) |
| Task board filters + overdue | `list_tasks` + `/tasks` UI | PASS (code) |
| Create task from thread | `CreateTaskForm` on inbox thread | PASS (code) |
| Notes + convert + seal on complete/cancel/abandon | notes panel + SQL seals | PASS (code / static) |
| Mentions sync / task_files upload | deferred; tasks 1.4 / 3.2 unchecked | GAP |
| External contacts admin | `/settings/external-contacts` | PASS (code) |
| Case export download | `ExportCaseButton` + `export_case` | PASS (code) |
| Timeline/merge include notes & tasks | migration rewrite + citizens repository | PASS (code / static) |
| Support read-only | pages gate `canMutate` | PASS (code) |
| No BOT LLM / OPS / WA-08 / WA-11 | tasks.md 6.x checked; not implemented | PASS |
| Live curl / browser / pgTAP | reports 5.2–5.4 | GAP (NO_DOCKER) |
| Independent adversarial (PGlite) | PASS WITH GAPS after blocker fixes | PASS WITH GAPS |
