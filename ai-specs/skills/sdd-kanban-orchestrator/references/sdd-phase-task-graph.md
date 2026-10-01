# SDD Kanban — Phase Task Graph (OpenSpec alignment)

Board slug: `openspec-sdd`  
Orchestrator profile: `project-director`  
Human gates: `blocked` until human unblocks via CLI or dashboard.

## Status columns (Hermes native)

`triage → todo → ready → running → blocked → done → archived`

## Epic template per feature

Replace `{change}`, `{project}`, `{branch}`.

| ID key | Title | Assignee | Workspace | Skills | Parents | Initial status |
|---|---|---|---|---|---|---|
| epic | SDD: {change} | project-director | dir:{project} | project-director | — | triage |
| p0-bootstrap | Phase 0 — bootstrap SDD | project-director | dir:{project} | project-sdd-init | epic | todo |
| p2-enrich | Phase 2 — enrich user story | project-director | dir:{project} | enrich-us, project-director | p0-bootstrap | todo |
| p3-plan | Phase 3 — OpenSpec plan (ff) | project-director | dir:{project} | openspec-ff-change, project-director | p2-enrich | todo |
| gate-plan | GATE — human plan approval | project-director | dir:{project} | project-director | p3-plan | blocked |
| p4-backend | Phase 4 — backend apply | backend-developer | worktree | openspec-apply-change | gate-plan | todo |
| p4-frontend | Phase 4 — frontend apply | frontend-developer | worktree | openspec-apply-change | gate-plan | todo |
| p5-verify | Phase 5 — mechanical verify | project-director | dir:{project} | openspec-verify-change | p4-backend, p4-frontend | todo |
| p6a-matrix | Phase 6a — acceptance matrix | project-director | dir:{project} | project-director | p5-verify | todo |
| p6b-audit | Phase 6b — adversarial review | project-director | dir:{project} | adversarial-review | p6a-matrix | todo |
| gate-archive | GATE — human archive OK | project-director | dir:{project} | project-director | p6b-audit | blocked |
| p7-archive | Phase 7 — archive change | project-director | dir:{project} | openspec-archive-change | gate-archive | todo |

## Parallel lanes

`p4-backend` and `p4-frontend` share parent `gate-plan` only — no link between them. Dispatcher runs both when gate unblocks.

## Worker rules (all SDD tasks)

1. Read `docs/base-standards.md` and `openspec/changes/{change}/` before acting.
2. English artifacts; Spanish only for human comments if user prefers.
3. Director/orchestrator profiles: **no production code** in backend/frontend.
4. Adversarial task: reviewer must NOT trust implementer tests alone.
5. Spec revision mid-flight: block epic, run dirty-spec protocol, reset worktrees.

## Human gate unblock

```bash
hermes kanban --board openspec-sdd comment <gate-id> "Plan approved"
hermes kanban --board openspec-sdd unblock <gate-id>
```

## Swarm shortcut (audit wave)

After apply completes, optional swarm for verify + audit:

```bash
hermes kanban --board openspec-sdd swarm "Verify and audit {change}" \
  --worker project-director:Phase 5 verify:openspec-verify-change \
  --worker project-director:Phase 6a matrix:project-director \
  --verifier project-director \
  --synthesizer project-director
```

Use only when plan is already approved and apply tasks are done.
