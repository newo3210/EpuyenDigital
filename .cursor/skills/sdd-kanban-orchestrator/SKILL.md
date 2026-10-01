---
name: sdd-kanban-orchestrator
description: OpenSpec SDD decomposition playbook for Hermes Kanban. Maps project-director phases to kanban tasks, profiles, worktrees, and human gates. Use when orchestrating features on board openspec-sdd or when project-director routes work through Kanban instead of chat-only.
author: LIDR.co
version: 1.0.0
disable-model-invocation: true
metadata:
  hermes:
    tags: [kanban, openspec, sdd, orchestration]
    related_skills: [kanban-orchestrator, project-director, devops-kanban-orchestrator]
---

# SDD Kanban Orchestrator

OpenSpec-aligned Kanban playbook for Hermes. Load **after** `kanban-orchestrator` (Hermes bundled) and `project-director`.

Speak to the human in **Spanish**. Write task bodies and artifacts in **English**.

## When to invoke

- User starts a feature on board `openspec-sdd`
- `project-director` profile is routing SDD work through Kanban
- User says "SDD kanban", "openspec board", "orquestar en hermes"

## Board

- **Slug:** `openspec-sdd`
- **Switch:** `hermes kanban boards switch openspec-sdd`
- **Setup script:** `ai-specs/scripts/setup-sdd-kanban-board.ps1`

## Fixed profile roster (this install)

| Profile | Role |
|---|---|
| `project-director` | Orchestrator, enrich, plan, verify, matrix, archive |
| `backend-developer` | Backend apply (plan-only agent; apply via skill) |
| `frontend-developer` | Frontend apply |

Run `hermes profile list` before fan-out if unsure.

## Phase graph

See [references/sdd-phase-task-graph.md](references/sdd-phase-task-graph.md).

**Anti-temptation (inherits kanban-orchestrator):**

- Orchestrator creates cards; workers implement.
- Never assign production code to `project-director`.
- Human gates stay `blocked` until explicit approval.
- Adversarial review = separate task after matrix; fresh context preferred.

## Creating a new feature epic

1. Confirm project path (`dir:` workspace) and kebab-case `{change}` name.
2. Run setup script OR create graph manually:

```powershell
.\ai-specs\scripts\setup-sdd-kanban-board.ps1 `
  -ProjectPath "D:\path\to\repo" `
  -ChangeName "my-feature"
```

3. Monitor: `hermes kanban --board openspec-sdd list`
4. Dispatcher runs in gateway — ensure gateway is started.

## Per-task worker instructions (template)

Every worker body should include:

```markdown
## Change
openspec/changes/{change}/

## Phase
[phase name]

## Do
[specific deliverable]

## Do not
- Skip reading spec.md / tasks.md
- Mark tasks [x] without evidence
- Archive without human gate

## Done when
[concrete exit criteria]
```

## Phase specifics

### Phase 0 — bootstrap

Skill: `project-sdd-init`. Skip if `ai-specs/` and `openspec/` exist and Phase 0 PASS.

### Phase 2 — enrich

Output: `tmp/{change}-enriched-us.md`. Stop if critical ambiguity.

### Phase 3 — plan

Skills: `openspec-ff-change` or assisted write to `openspec/changes/{change}/`.  
Then **block** on `gate-plan` until human OK.

### Phase 4 — apply (parallel)

- `p4-backend` → `feature/{change}` worktree, backend sections of `tasks.md`
- `p4-frontend` → same branch name, frontend sections
- Skills: `openspec-apply-change`

### Phase 5 — verify

Skill: `openspec-verify-change`. CRITICAL findings → new fix tasks, not archive.

### Phase 6a — acceptance matrix

Create `openspec/changes/{change}/reports/acceptance-matrix.md` from spec literals.

### Phase 6b — adversarial review

Skill: `adversarial-review`. Trigger: `audit {change}`.  
Writer ≠ reviewer. No "verify green = done".

### Phase 7 — archive

Only after `gate-archive` unblocked. Skill: `openspec-archive-change`.

## Dirty spec protocol

If spec changes after apply:

1. `kanban_block` epic with reason `spec-revised`
2. Create cleanup task (worktree reset / branch v2)
3. Re-run from Phase 3 after human OK

## Red flags

Never:
- Skip human gates
- Link backend before frontend sequentially (they are parallel siblings)
- Use `scratch` workspace for code that must persist (use `worktree` or `dir:`)

Always:
- Pin workspace to project root: `dir:D:/path/to/repo`
- Use idempotency keys: `sdd-{change}-{phase}`
- Comment task with evidence paths (reports/, test output)
