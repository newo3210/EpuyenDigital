---
name: project-sdd-init
description: Bootstrap Spec-Driven Development into an existing codebase that has no OpenSpec structure. Use when /director init detects missing ai-specs/ or openspec/, or when onboarding a legacy project before first feature.
author: LIDR.co
version: 1.0.0
disable-model-invocation: true
---

# project-sdd-init Skill

Bootstrap SDD into a **legacy project** (code exists, no OpenSpec). Run after `/director init` fails Phase 0 or when the user asks to onboard an existing repo.

Speak to the user in **Spanish**. Write artifacts in **English**.

## When to invoke

- `/director init` reports missing `ai-specs/` or `openspec/`
- User says: "proyecto existente sin specs", "onboarding código viejo", "bootstrap SDD"
- Before any `/director <feature>` on a non-bootstrapped repo

## Prerequisites

- **Template source** (one of):
  - Env `OPENSPEC_TEMPLATE_REPO` → path to this factory clone (e.g. `D:\Repositorios\OpenSpecs-Template`)
  - Or user provides path in chat
- Project root is a git repo (recommended, not mandatory)

## Phase 0 — Hyperstrict order (mandatory)

```text
1. Bootstrap (install structure)
2. Sync/Copy (local mirrors)
3. Verify rules (.cursor/rules readable)
4. Archaeology → base-standards.md (legacy only)
5. Phase 0 PASS → ready for /director <feature>
```

Never skip step 4 on legacy projects.

---

## Step 1 — Bootstrap (physical copy, not symlink)

Copy from `$OPENSPEC_TEMPLATE_REPO` into project root. **Skip** `backend/`, `frontend/`, `node_modules/`, `.git`.

| Source (template) | Destination (target project) |
|---|---|
| `ai-specs/` | `ai-specs/` |
| `openspec/config.yaml` + `openspec/schemas/` + empty `changes/` + `specs/` | `openspec/` |
| `.cursor/commands/` (opsx + director) | `.cursor/commands/` |
| `.cursor/rules/sdd-orchestration.mdc` | `.cursor/rules/` |
| `.cursor/rules/use-base-rules.mdc` | `.cursor/rules/` (if missing) |

Create if missing:
- `openspec/changes/archive/`
- `openspec/specs/` (empty or with README)
- `tmp/`

Do **not** copy another project's `openspec/changes/*` active work — only structure and schemas.

PowerShell reference:

```powershell
$src = $env:OPENSPEC_TEMPLATE_REPO  # e.g. D:\Repositorios\OpenSpecs-Template
$dst = Get-Location
Copy-Item -Recurse -Force "$src\ai-specs" "$dst\"
New-Item -ItemType Directory -Force "$dst\openspec\changes\archive" | Out-Null
Copy-Item -Recurse -Force "$src\openspec\config.yaml" "$dst\openspec\"
Copy-Item -Recurse -Force "$src\openspec\schemas" "$dst\openspec\schemas"
Copy-Item -Recurse -Force "$src\.cursor\commands" "$dst\.cursor\commands"
Copy-Item -Force "$src\.cursor\rules\sdd-orchestration.mdc" "$dst\.cursor\rules\"
```

---

## Step 2 — Sync/Copy mirrors

Run skill `sync-agent-symlinks`:

1. Symlink `.cursor/skills/<name>` → `../../ai-specs/skills/<name>`
2. On Windows failure → **physical copy** (copy-fallback mode)
3. Copy/symlink `.cursor/agents/project-director.md` from `ai-specs/agents/`
4. Mirror `.claude/` if team uses Claude Code

Report `copy-fallback` if copies were used.

---

## Step 3 — Verify rules

Confirm readable:

- `docs/base-standards.md` (may not exist yet on legacy — OK for step 3 if rules exist)
- `.cursor/rules/sdd-orchestration.mdc`
- `.cursor/commands/director.md`
- Critical skills: `project-director`, `enrich-us`, `adversarial-review`

If `docs/base-standards.md` missing → proceed to Step 4 (required for legacy).

---

## Step 4 — Archaeology (legacy projects only)

**Goal:** `docs/base-standards.md` reflects **actual** codebase, not invented patterns.

1. Read project README, package.json, docker-compose, main entry points
2. Map stack: languages, frameworks, folder layout, test runner, API style
3. Read 3–5 representative files per layer (routes, services, main UI)
4. Extract **existing** conventions (naming, error handling, i18n, auth)
5. Write or overwrite `docs/base-standards.md` with:
   - Core principles (match team reality)
   - Stack summary
   - Pointers to `docs/backend-standards.md` / `docs/frontend-standards.md` if created
   - SDD entry point: `/director`
   - Conceptual layer mapping (§9 style) with **this project's** concrete paths
6. Optionally scaffold `docs/backend-standards.md` and `docs/frontend-standards.md` from code archaeology
7. **Root documentation (recommended on first bootstrap):** create or update:
   - `ARCHITECTURE_SDD.md` (English) from `project-director/references/architecture-sdd-template.md`
   - `STUDENT_DECISION_LOG.md` (Spanish) from `project-director/references/student-decision-log-template.md`
8. **Clean Architecture audit (read-only):** list modularity findings (Blocker/Major/Minor) in the Spanish summary; do not refactor unless user opens a later change. Prefer `/director docs-baseline` for a dedicated pass.

Present summary to human in Spanish. Wait for OK before first feature.

---

## Step 5 — Phase 0 PASS report

```markdown
## Bootstrap complete
- Mode: copy-fallback | symlink
- Template: <path>
- base-standards.md: created | updated | existing
- Ready: yes/no
- Next: /director <first feature>
```

---

## Red flags

Never:
- Invent architecture not present in code during archaeology
- Copy active `openspec/changes/<feature>/` from template repo
- Start `/opsx:apply` before base-standards exists on legacy projects
- Assume global CLI `openspec` is installed

Always:
- Physical copy on Windows when symlinks fail
- English artifacts, Spanish UX
- Human OK after archaeology before first feature spec
