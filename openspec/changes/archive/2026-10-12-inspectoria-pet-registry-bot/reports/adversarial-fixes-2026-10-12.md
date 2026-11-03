# Adversarial fixes — 2026-10-12

Addresses FAIL findings from `reports/adversarial-review.md` for change `inspectoria-pet-registry-bot`.

| Finding | Severity | Status | Notes |
|---|---|---|---|
| Photo→finish race | Blocker | **Fixed** | Completion gated on pending media `storagePath`; re-prompt `animal.photos_saving`; test does not drain before `listo`. |
| Non-idempotent completion | Blocker | **Fixed** | Mark `completing` first; `completedAnimalId` / `completedMunicipalId` on payload; `mark_session_completion` SQL RPC; double-finish Vitest. |
| Session lock missing | Blocker | **Fixed** | `lock_registration_session` (`FOR UPDATE`); memory `runWithSessionLock` per-phone mutex. |
| Per-line webhook secret unused | Major | **Fixed** | `ingestInboundEvent` verifies `line.webhookSecret` (503 if null); env only seeds local memory line. |
| `fromMe` drives bot | Major | **Fixed** | Persist as outbound; no `process_inbound` enqueue. |
| `health_card` kind wrong | Major | **Fixed** | `pendingMediaKinds` on session; link uses stored kind; `getPendingAnimalIdForSession` returns `completedAnimalId`. |
| Returning citizen geo omitted | Major | **Fixed** | `hydrateCitizenGeo` copies lat/lng (and PII for upsert) before complete. |
| confirm/update ignored | Major | **Fixed (narrowed)** | Explicit OK only; i18n + conversation / channel specs updated. |
| `citizenUpsertSchema` not enforced | Major | **Fixed** | Parsed in memory + Supabase upsert paths. |
| Invented `externalId` | Major | **Fixed** | Missing `key.id` → normalize `ignored: invalid` (200). |
| Live SQL/pgTAP unproven | Major | **Open** | Still environment-blocked; migration + RPC shipped; not a substitute for `supabase test db` before archive. |

## Verification

- `npm run test`
- `npm run typecheck`
- `npm run lint`
