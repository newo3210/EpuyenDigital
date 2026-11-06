# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-30)

**Core value:** Ningún mensaje de un vecino queda sin respuesta ni sin dueño: bot con info oficial o cola visible con trazabilidad.
**Current focus:** Phase 2 channel applied on branch; next epic `mesa-entrada-inbox`

## Current Position

Phase: 2 of 7 (Canal WhatsApp) — implementation on `cursor/whatsapp-channel-core-0e30`  
Plan: OpenSpec `whatsapp-channel-core` **implemented (tasks 1–7); §8 director close pending**  
Status: Conversations + line admin + inbound/outbound + composer; Vitest green; Docker/live DB/E2E gaps documented.  
Last activity: 2026-11-06 — apply whatsapp-channel-core

Progress: [████░░░░░░] ~35% (foundation + areas/operators + channel core code)

## Performance Metrics

**Velocity:**
- Total plans completed: 2 archived (+ channel core in flight)
- Average duration: -
- Total execution time: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [2026-11-06 channel]: Conversations now (D1); forward-only messages (D2); AES secrets with CREDENTIALS_ENCRYPTION_KEY (D3); shared line default → Mesa (D4); location on message only (D5); minimal `/inbox` composer (D6); seguros port with corrections (D7); pet coexistence (D8)

### Pending Todos

- Director: mechanical verify → acceptance matrix → adversarial → human OK → archive
- Open + implement `mesa-entrada-inbox` after archive
- Live `supabase db reset` / pgTAP / curl / E2E when containers available
- WA-08 media send from panel (image/PDF/audio) beyond text composer

### Blockers/Concerns

- Agent env without Docker/Podman: SQL live proof, curl against stack, E2E browser pending
- Line admin secret writes require `CREDENTIALS_ENCRYPTION_KEY` in env

### Process

- 2026-11-06: `areas-operators-admin` archived; merge PR #5.
- 2026-11-06: `whatsapp-channel-core` plan + apply on `cursor/whatsapp-channel-core-0e30`.

## Session Continuity

Last session: 2026-11-06
Stopped at: Channel core implementer handoff (tasks 1–7); §8 director-owned
Resume file: None
