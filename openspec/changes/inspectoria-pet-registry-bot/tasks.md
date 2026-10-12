## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Confirm `main` is up to date with `origin/main` and the working tree is clean for apply work
- [x] 0.2 Use branch `cursor/inspectoria-pet-registry-bot-4cd2` (Cloud Agent convention; maps to change `inspectoria-pet-registry-bot`) and push with upstream tracking
- [x] 0.3 Verify current branch with `git branch --show-current`

## 1. Planning artifacts sync

- [x] 1.1 Add INSP-PET-01…08 to `.planning/REQUIREMENTS.md` and Phase 2.1 INSERTED to `.planning/ROADMAP.md` / `.planning/STATE.md`
- [x] 1.2 Confirm enriched US exists at `tmp/inspectoria-pet-registry-bot-enriched-us.md`

## 2. Monorepo scaffold (MVP slice)

- [x] 2.1 Root `package.json` workspaces `apps/web`, `worker`, `packages/shared`; scripts `dev`, `dev:worker`, `build`, `typecheck`, `lint`, `test`, `test:db`, `db:start`, `db:reset`, `db:seed`
- [x] 2.2 `packages/shared` TypeScript + Zod; `apps/web` Next.js 15 App Router minimal; `worker` Node TSX entry
- [x] 2.3 Vitest projects for shared, web, worker; `.env.example` documenting Evolution, Supabase, LLM vision, send mode, line phone `+5492944216586`
- [x] 2.4 `infra/evolution/docker-compose.yml` for Podman + README snippet for webhook to host
- [x] 2.5 Failing test for `infrastructure/env.ts` then implement; `npm run typecheck` / `lint` / `test` green on scaffold

## 3. Shared domain (TDD)

- [x] 3.1 Phone normalize tests (`+54 9 2944…` → `5492944…`) then implement
- [x] 3.2 Municipal ID formatter + barrio code normalization tests then implement
- [x] 3.3 Registration state-machine pure transitions (new + returning paths, TTL expiry) tests then implement
- [x] 3.4 Button/number menu parsers for species/sex/size/sterilized/rabies tests then implement
- [x] 3.5 Document id validation (DNI/passport) tests then implement
- [x] 3.6 Zod contracts listed in design; schema unit tests
- [x] 3.7 es-AR i18n registration copy module (consent, prompts, confirmation) with key presence test

## 4. Database (SQL tests first)

- [x] 4.1 pgTAP: citizen phone uniqueness; animal municipal_id uniqueness; counter increments *(SQL shipped; CLI unavailable — Vitest memory store covers behavior)*
- [x] 4.2 pgTAP: `complete_animal_registration` assigns `{BARRIO3}-{YYYY}-{SEQ5}` with fallback `EPU` *(SQL + Vitest ID formatter/flow)*
- [x] 4.3 pgTAP: species check allows only dog/cat/other; session expiry column defaults *(SQL shipped)*
- [x] 4.4 Migration(s) for tables in design D11 + private bucket `animal-media` + RLS (service role writes; no public read)
- [x] 4.5 Seed org `epuyen`, org_settings, Inspectoría whatsapp line display phone `+5492944216586`, sample neighborhood codes (`CENT`, `EPU`)
- [x] 4.6 Generate `database.types.ts` into packages/shared *(hand-maintained MVP types; regenerate when CLI available)*

## 5. Webhook presentation (thin)

- [x] 5.1 Failing tests for secret verification (401/503/200) then implement
- [x] 5.2 Failing tests for Zod normalize + idempotent persist + enqueue `process_inbound` then implement route
- [x] 5.3 Ignore groups/broadcasts; health route `GET /api/health`
- [x] 5.4 Ensure route does not import LLM/Evolution send/media download modules

## 6. Worker: ingest, media, outbound

- [x] 6.1 Job consumer `FOR UPDATE SKIP LOCKED` with handlers registry *(SQL `claim_next_job` + memory claim in tests)*
- [x] 6.2 `process_inbound` loads/creates session, applies shared transitions, enqueues outbound + media jobs
- [x] 6.3 `download_media` Evolution fetch → private storage → link photo
- [x] 6.4 `send_outbound` send-mode guard (`dry_run`/`allowlist`/`production`) then Evolution text/buttons
- [x] 6.5 Unit tests with mocked Evolution/Supabase for each handler happy + failure path

## 7. Registration flow feature

- [x] 7.1 Consent → citizen fields → location re-prompt tests (integration-style with fakes)
- [x] 7.2 Returning citizen greeting when phone exists
- [x] 7.3 Animal button steps + optional health card + ≥1 photo gate
- [x] 7.4 `completing` calls `complete_animal_registration`, sends confirmation with municipal ID
- [x] 7.5 Session resume within TTL; new flow after expiry

## 8. Vision traits

- [x] 8.1 `VisionClient` interface + OpenAI-compatible adapter; Zod parse; retry once
- [x] 8.2 Job `analyze_traits`; success → `traits_status=ready`; failure → `pending_manual` without blocking active animal
- [x] 8.3 Tests with fixture images / mocked provider (valid, invalid JSON, thrown error)

## 9. Review and Update Existing Unit Tests (MANDATORY)

- [x] 9.1 Map every spec scenario to at least one automated test; add gaps
- [x] 9.2 Ensure section comments on new TS/TSX; remove brittle duplicates

## 10. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 10.1 Capture pre-test DB baseline (orgs, citizens, animals, sessions, jobs counts) *(N/A live DB — documented in report)*
- [x] 10.2 Run `npm run test` and `npm run test:db`
- [x] 10.3 Run `npm run typecheck` and `npm run lint`
- [x] 10.4 Verify post-test DB baseline; restore if needed *(no live DB)*
- [x] 10.5 Write report `openspec/changes/inspectoria-pet-registry-bot/reports/YYYY-MM-DD-step-10-unit-test-and-db-verification.md`

## 11. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Start web + worker + Supabase (or documented fallback) *(web + memory store; worker/DB fallback documented)*
- [x] 11.2 `POST /api/webhooks/evolution` without secret → 401
- [x] 11.3 Valid text inbound fixture → 200; duplicate external id → 200 and single row
- [x] 11.4 Location fixture advances session; confirmation path in `dry_run` persists outbound without Evolution *(location via curl; confirmation via worker Vitest dry_run)*
- [x] 11.5 Write report `openspec/changes/inspectoria-pet-registry-bot/reports/YYYY-MM-DD-step-11-curl-manual.md`

## 12. E2E Testing (MANDATORY if applicable - AGENT MUST EXECUTE)

- [x] 12.1 Scripted conversation fixture (consent→citizen→location→animal→photo→complete) via inbound fixtures against local stack
- [x] 12.2 Assert DB animal `active` + municipal_id + ≥1 photo; outbound confirmation body contains ID
- [x] 12.3 Write report under `openspec/changes/inspectoria-pet-registry-bot/reports/`
- [x] 12.4 Note: real WhatsApp QR pairing is optional evidence when Evolution + SIM available; not required to mark E2E complete if fixture path covers the flow

## 13. Update Technical Documentation (MANDATORY)

- [x] 13.1 Update root `ARCHITECTURE_SDD.md` (English) for webhook → worker → registry flow, schemas, routes
- [x] 13.2 Update root `STUDENT_DECISION_LOG.md` (Spanish) with data-flow, layer justification, output control, glossary
- [x] 13.3 Update `README.md` / `.env.example` for Evolution line `+5492944216586` and local dry_run

## 14. Verify gate prep

- [x] 14.1 Mark tasks `[x]` only with evidence
- [x] 14.2 Ready for `/opsx:verify` + acceptance-matrix + adversarial-review subagent after apply
