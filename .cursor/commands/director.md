---

## name: /director
id: director
category: Workflow
description: Project Director — orchestrate SDD from idea to archive (Spanish UX, English specs)

Orchestrate Spec-Driven Development using the **project-director** skill. The director does not write production code; it coordinates OpenSpec, delegates to subagents, and enforces human checkpoints.

**Input**: Optional argument after `/director`:


| Argument        | Behavior                                                       |
| --------------- | -------------------------------------------------------------- |
| *(empty)*       | Ask what the user wants to build                               |
| `init`          | Bootstrap/sync check only (Phase 0)                            |
| `docs-baseline` | Legacy projects: archaeology + root docs + Clean Architecture audit (no new feature) |
| `parallel ...`  | Inform Phase 3 script required; offer assisted sequential mode |
| `<description>` | Full assisted pipeline for that feature                        |
| `<change-name>` | Resume or operate on existing change if inferrable             |


**Steps**

1. **Load project-director skill**
  Read and follow `ai-specs/skills/project-director/SKILL.md` in full before any action.
2. **Adopt project-director agent persona**
  Read `ai-specs/agents/project-director.md` for role limits (no production code, Spanish UX to user, English artifacts).
3. **Run Phase 0 — bootstrap**
  - Verify `docs/base-standards.md`, `ai-specs/`, `openspec/config.yaml`, `openspec/changes/`, `openspec/specs/`
  - **Assisted mode:** OpenSpec global CLI is **not required** — read/write `openspec/changes/` and use `ai-specs/scripts/` directly (see skill Phase 0)
  - Run `sync-agent-symlinks` if mirrors may be stale
  - Report bootstrap status; stop only if core paths missing (unless `init`)
4. **Execute pipeline per skill**
  Follow phases 1–7 in the skill based on user input:
  - Enrich → opsx:new → opsx:ff → **human approval** → apply (delegate programmer subagent) → verify → acceptance-matrix → **auto adversarial-review subagent** → fix loop if needed → **human OK** → archive
5. **Report after each phase**
  Use the status format from the skill. Speak to the user in Spanish if they use Spanish.

**Guardrails**

- Do NOT write or edit files in `backend/` or `frontend/` directly — use `/opsx:apply` or delegated agents
- Do NOT run adversarial-review yourself — always spawn independent subagent (do not ask human first)
- Do NOT write production code — delegate programmer subagent for `/opsx:apply`
- Do NOT treat verify green as done
- Do NOT re-apply after spec change without dirty-spec cleanup (skill Phase protocol)
- Do NOT archive without explicit human approval
- Read `docs/como-incorporar-openspec-a-cursor.md` for architecture context when user asks why

**Related commands**

- `/opsx:new`, `/opsx:ff`, `/opsx:apply`, `/opsx:verify`, `/opsx:archive`
- `/opsx:onboard` — first-time learning walkthrough

**Output on start**

```
## Project Director

Modo: asistido (chat)
Skill: project-director
Spec language: English | UX: Español (si aplica)

[Fase 0: bootstrap...]
```

Then continue per skill phases.