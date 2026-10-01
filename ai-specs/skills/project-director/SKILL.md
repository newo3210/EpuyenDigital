---
name: project-director
description: Orchestrates Spec-Driven Development from vague user intent through OpenSpec artifacts, delegation, verification, and archive. Use when the user invokes /director, asks to start a feature with specs, or needs SDD guidance without writing specs manually. Handles bootstrap, enrich-us, opsx pipeline, human checkpoints, anti-circular review, and spec-revision cleanup.
author: LIDR.co
version: 1.2.0
disable-model-invocation: true
---

# project-director Skill

**Announce at start:** "I'm using the project-director skill to orchestrate this SDD workflow."

Speak to the user in **Spanish** if they use Spanish. Write all specs, tasks, and technical artifacts in **English**.

## When to invoke

- User runs `/director` or `/director <request>`
- User runs `/director init` (bootstrap check only)
- User describes a feature but does not know OpenSpec commands
- User asks to "orchestrate", "coordinate agents", or "do this with specs"

## Embedded minimum rules (bootstrap / degraded mode)

Use only when `docs/base-standards.md` is missing or unreadable:

1. Spec-first — no production code before approved artifacts
2. TDD — failing tests before implementation
3. Writer ≠ reviewer — adversarial review in a **new session**
4. Spec revision mid-flight → reset branch or new worktree before re-apply
5. `/opsx:verify` green is not done — need acceptance matrix + human OK
6. Clean Architecture by conceptual layers (presentation → application/services → infrastructure/repositories → contracts); concrete paths in `design.md`
7. Root docs required before archive: `ARCHITECTURE_SDD.md` (EN) + `STUDENT_DECISION_LOG.md` (ES)

Once bootstrap succeeds, **prefer project files** over this embedded subset.

---

## Phase 0 — Bootstrap (mandatory first)

Before any SDD work, verify project readiness:

```text
Required paths:
  docs/base-standards.md
  ai-specs/skills/
  ai-specs/agents/
  openspec/config.yaml
  openspec/changes/ and openspec/specs/
  .cursor/commands/director.md (or equivalent entry)
```

### Assisted OpenSpec mode (this project — no global CLI)

**Do not block Phase 0** when `openspec` binary is missing from PATH.

This project runs OpenSpec **asistido**:

| CLI command | Assisted equivalent |
|---|---|
| `openspec new change` | Create `openspec/changes/<name>/` + `.openspec.yaml` manually |
| `openspec ff` / continue | Write `proposal.md`, `specs/`, `design.md`, `tasks.md` from templates in `openspec/schemas/` |
| `openspec apply` | Implement per `tasks.md`; mark `[x]` as done |
| `openspec verify` | Check tasks, spec coverage, reports per §6.1 and skill `openspec-verify-change` logic |
| `openspec archive` | Move to `openspec/changes/archive/`, merge delta specs into `openspec/specs/` |

Use `ai-specs/scripts/` when scripts exist; otherwise agent reads/writes local folders directly.

**Phase 0 PASS criteria (assisted):** all required paths exist + critical skills readable. CLI optional.

### If missing — legacy project bootstrap

If `ai-specs/` or `openspec/` is missing:

1. Load and follow skill **`project-sdd-init`** (global: `~/.cursor/skills/project-sdd-init/` or project copy)
2. Set `OPENSPEC_TEMPLATE_REPO` to bootstrapped template path (e.g. `D:\Repositorios\OpenSpecs`) — or read `~/.cursor/openspec.env`
3. Run hyperstrict order: bootstrap → sync/copy → verify rules → **archaeology** → `base-standards.md`
4. Re-run Phase 0; only continue to Phase 1 after PASS

Do not invent a partial structure ad hoc — use `project-sdd-init` scaffold from template repo.

### Sync mirrors

Run skill `sync-agent-symlinks` (or manual equivalent):

1. Try symlink: `.cursor/skills/<name>` → `../../ai-specs/skills/<name>`
2. If symlink fails (common on Windows): **physical copy** of the skill folder to `.cursor/skills/<name>` and report `copy-fallback` mode
3. Verify `project-director`, `enrich-us`, `adversarial-review` are readable
4. Agent symlink: `.cursor/agents/project-director.md` → `../../ai-specs/agents/project-director.md`

If rules are still unreachable, ensure `.cursor/rules/sdd-orchestration.mdc` exists.

**Only after Phase 0 passes → continue.**

---

## Phase 1 — Understand intent

Parse user input:

| Input | Action |
|---|---|
| `/director init` | Run Phase 0 only; report status |
| `/director docs-baseline` | Run **Docs baseline + Clean Architecture audit** (below); stop after human summary |
| `/director parallel ...` | Tell user parallel mode requires Phase 3 `orchestrate.sh`; offer sequential assisted mode |
| `/director <idea>` | Full assisted pipeline below |
| Empty `/director` | Ask: "¿Qué quieres construir o cambiar?" |

Classify:

- **Docs baseline / legacy audit** → Docs baseline workflow (no feature apply)
- **New feature** → full pipeline
- **Bug on active change** → update spec first (base-standards §7), then apply
- **Review only** → load change → acceptance-matrix → suggest new session for adversarial-review
- **Archive** → verify checklist → `/opsx:archive` with human OK

---

## Docs baseline + Clean Architecture audit (legacy / already-built projects)

Use when the user says `/director docs-baseline`, "documentá este proyecto", "bitácora de argumentación", or "revisá clean architecture" **without** asking for a new feature.

**Goal:** leave the repo with honest root docs and a modularity report. **Do not** rewrite production code unless the user explicitly asks for a follow-up change (then open an OpenSpec change).

### Steps

1. **Phase 0** — if `ai-specs/` / `openspec/` missing, run `project-sdd-init` first (bootstrap + sync). If already bootstrapped, continue.
2. **Archaeology** — README, package manifests, entry points, 3–5 files per conceptual layer. Map **actual** folders to presentation / application-services / infrastructure-repositories / contracts (base-standards §9). Never invent layers that do not exist.
3. **Write / update root docs** from templates in `references/`:
   - `ARCHITECTURE_SDD.md` (English) — real paths, flows, schemas, gaps
   - `STUDENT_DECISION_LOG.md` (Spanish) — data-flow map, why layers are split (or why they are not), output-control story, glossary, oral-defense bullets
4. **Modularity / Clean Architecture audit** (read-only) — report in Spanish to the user and append a short section to `STUDENT_DECISION_LOG.md` §6 or §7:
   - What already respects thin presentation / services / repositories / schemas
   - Coupling smells (UI calling DB, AI in components, fat controllers, god modules)
   - Severity: Blocker / Major / Minor / Suggestion
   - Recommended next OpenSpec changes (do **not** auto-fix)
5. **Optional:** if `docs/base-standards.md` is missing or generic, update it via archaeology (`project-sdd-init` Step 4).
6. Stop. Present summary. Ask whether to open a **refactor change** for the top findings.

**Red flags for this mode:** silent large refactors; fake Zod/LLM sections; claiming Clean Architecture when the repo is a single-folder script (describe reality instead).

---

## Phase 2 — Enrich (business questions)

Do **not** call a separate product-strategy agent. You perform enrich-us behavior:

1. Read `docs/base-standards.md` and relevant standards (backend/frontend)
2. Ask **incómodas pero concretas** until scope is clear:
   - Who is the user? Happy path? Error cases? Out of scope?
   - API shape? UI routes? i18n? Performance/security constraints?
3. If Jira ticket provided, use Jira MCP via skill `enrich-us` steps
4. Save enriched intent to `tmp/<change-name>-enriched-us.md` (create `tmp/` if needed)

Stop if critical ambiguity remains — list open questions numbered for the user.

---

## Phase 3 — Create change + plan (OpenSpec)

1. Derive kebab-case change name from intent
2. Create change folder (assisted): `openspec/changes/<name>/` + `.openspec.yaml`, or run `/opsx:new` if CLI available
3. Write artifacts (assisted): `proposal.md`, `specs/*/spec.md`, `design.md`, `tasks.md` from `openspec/schemas/lti-sdd/templates/`, or run `/opsx:ff` if CLI available
4. Read all generated artifacts

**Architecture & docs (mandatory in plan):**

5. In `design.md`, declare the **conceptual layer mapping** for this change (presentation / application-services / infrastructure-repositories / contracts) and the **concrete paths** in this repo — see `docs/base-standards.md` §9. Do not invent paths that contradict existing project layout.
6. In `design.md`, list Zod (or equivalent) contracts at API and LLM boundaries when applicable.
7. In `tasks.md`, include explicit tasks to create or update root:
   - `ARCHITECTURE_SDD.md` (English) — from [references/architecture-sdd-template.md](references/architecture-sdd-template.md)
   - `STUDENT_DECISION_LOG.md` (Spanish) — from [references/student-decision-log-template.md](references/student-decision-log-template.md)

**Present to human (Spanish summary, not raw markdown dump):**

- Por qué (1–2 frases)
- Qué cambia (bullets)
- Capas / archivos tocados (mapeo conceptual)
- Riesgos / fuera de alcance
- Checkpoints que pedirás después (incluye gate de docs raíz antes de archive)

**Wait for explicit approval:** user must say equivalent of "aprobado", "ok", "sí", "adelante".

If rejected → revise via `/opsx:continue` or edit artifacts with user guidance; re-present summary.

---

## Phase 4 — Delegate implementation (assisted mode)

After plan approval:

1. Create isolated workspace — skill `using-git-worktrees` (branch `feature/<change-name>`)
2. Run `/opsx:apply` (skill `openspec-apply-change`) **or** delegate slices:
   - Backend tasks → note in chat: invoke backend-developer for plan if needed, then apply backend sections
   - Frontend tasks → same with frontend-developer
3. Enforce Clean Architecture from `design.md`: presentation stays thin; AI/business logic only in application/services; persistence only in infrastructure/repositories; schemas at boundaries
4. Ensure implementer updates root **`ARCHITECTURE_SDD.md`** (EN) and **`STUDENT_DECISION_LOG.md`** (ES) when the feature/route/module slice is complete (use templates under `references/` if files do not exist yet)
5. Mark tasks `[x]` only when actually done — including documentation tasks
6. If `--yolo` flag: auto-run terminal/tests/commits per `docs/como-incorporar-openspec-a-cursor.md` §7.3.2 — still keep **business** checkpoint at end

**You still do not write production code directly** — `/opsx:apply` or delegated implementer does. You **may** remind the implementer about docs tasks and refuse archive later if they are missing.

---

## Phase 5 — Verify (mechanical)

1. Run `/opsx:verify` (skill `openspec-verify-change`)
2. Additionally check root docs:
   - `ARCHITECTURE_SDD.md` exists, non-empty, mentions this change or updated date
   - `STUDENT_DECISION_LOG.md` exists, non-empty, includes data-flow, architecture justification, output control, glossary
3. Report CRITICAL / WARNING / SUGGESTION to user in Spanish — missing/empty root docs → **CRITICAL** for archive readiness
4. If CRITICAL → fix loop via apply or doc update; do not archive

**Remember:** verify passing ≠ business correct (circular validation risk).

---

## Phase 6 — Independent validation (mandatory)

### 6a — Acceptance matrix

Create `openspec/changes/<name>/reports/acceptance-matrix.md` using [references/acceptance-matrix-template.md](references/acceptance-matrix-template.md).

Copy WHEN/THEN scenarios literally from spec. Execute with curl, browser MCP, or read-only DB — not implementer's unit tests alone.

### 6b — Adversarial review (subagent — automatic)

**Do NOT ask the human** whether to launch the reviewer. **Always** spawn an independent subagent (Task tool) immediately after apply or after fix tasks complete.

Rules:
- Director **never** performs adversarial review in the same role/session that delegated apply.
- Subagent must read `ai-specs/skills/adversarial-review/SKILL.md` and audit spec vs code with evidence.
- Trigger phrase for subagent prompt: `audit <change-name>` (e.g. `audit filter-candidates-by-position`).
- After subagent returns: director **supervises only** — triage findings into `tasks.md` § fixes, delegate programmer subagent for code fixes, then **auto-launch re-audit** subagent again (no prompt to human).

Loop until verdict is **PASS** or **PASS WITH GAPS** with no Major/Blocker and human §11.4 OK for archive.

Report subagent verdict to human in Spanish summary; do not ask "¿lanzo el re-audit?"

### 6c — Demo (recommended)

Offer skill `show-spec-working` or manual demo steps.

---

## Phase 7 — Human acceptance + archive

Checklist before archive:

- [ ] User approved original plan
- [ ] `/opsx:verify` has no CRITICAL (or user accepts risk explicitly)
- [ ] acceptance-matrix.md exists with evidence
- [ ] adversarial-review done in separate session (or user waives with explicit message)
- [ ] **`ARCHITECTURE_SDD.md` exists at repo root and was updated for this change** (English)
- [ ] **`STUDENT_DECISION_LOG.md` exists at repo root and was updated for this change** (Spanish)
- [ ] User says archive is OK

**Hard gate:** If either root doc is missing, empty, or clearly stale relative to this change, **do not archive**. Delegate a docs update task first.

Run `/opsx:archive` (skill `openspec-archive-change`).

Summarize in Spanish: what shipped, where spec lives in `openspec/specs/`, pointer to root docs, follow-ups.

---

## Spec revision mid-flight (dirty spec protocol)

If requirements change **after** partial or full apply:

1. **Stop** apply
2. Update artifacts (`spec.md`, `design.md`, `tasks.md`) via `/opsx:continue` or manual edit + user OK
3. **Clean implementation** before re-apply (pick one):
   - **A (preferred):** new worktree + branch `feature/<change>-v2`
   - **B:** `git reset --hard` to commit before first apply of this change
   - **C:** revert commits for this change
4. Move old reports to `openspec/changes/<name>/reports/superseded/`
5. Re-run from Phase 4 only after user approves revised plan

Never stack new apply on code generated from an obsolete spec version.

---

## Status reporting format

After each phase, short update:

```markdown
## Director status — <change-name>
- Phase: [0–7 name]
- Change: `openspec/changes/<name>/`
- Branch/worktree: ...
- Blocked: yes/no — reason
- Next: what you need from the user
```

---

## Red flags

Never:
- Skip Phase 0 on a fresh project
- Archive without human OK
- Archive without updated root `ARCHITECTURE_SDD.md` and `STUDENT_DECISION_LOG.md`
- Self-review after apply in same session
- Ask human permission to launch adversarial-review subagent — **always launch automatically**
- Write production code in `backend/` or `frontend/` (delegate programmer subagent)
- Put AI/business logic in thin HTTP routes or UI components
- Parallel multi-worktree orchestration **only in chat** — defer to Phase 3 script

Always:
- Spec before code
- Plain-language summaries for the human
- English technical artifacts (`ARCHITECTURE_SDD.md` included); Spanish for `STUDENT_DECISION_LOG.md` and UX chat
- Conceptual layer mapping in `design.md` with concrete project paths
- Auto-spawn subagent for audit after implementation or fix tasks
