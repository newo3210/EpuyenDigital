## Context

`citizens` already stores `full_name`, `document_id`, `address_line`, `neighborhood`, `latitude`, `longitude`, `registration_status`, `party_kind`, and WhatsApp profile fields. `citizen_phones` is unique on `(org_id, phone_normalized)`. The channel stub creates an unregistered row on first contact. The pet worker writes `full_name` and `document_id` with the service role. `/citizens` is an empty state. Inquiry coordinates live on `messages` and must stay there.

## Goals / Non-Goals

**Goals:**

- An operator completes and corrects a ficha from the thread and from `/citizens`.
- A manual value survives later bot and channel writes.
- Search and merge stay inside one organization.
- Support can read and cannot mutate.

**Non-Goals:**

- Bot prompts, RAG, or confirmed extraction (Phase 6).
- Notes, tasks, or a unified case file beyond messages, events, and animals (Phase 5).
- A second DNI column next to `document_id`.
- Copying a message pin onto `citizens.latitude` / `citizens.longitude`.
- Auto-merge of similar names.

## Decisions

### D1 — `document_id` is the DNI

The UI label is DNI. The column stays `document_id`, which the pet registry already fills. A person is registered only with a non-empty name, a `document_id`, and at least one phone. An organization is registered with a non-empty name and at least one phone; `document_id` stays optional.

### D2 — Manual source wins

Add `field_sources jsonb not null default '{}'` with keys `full_name`, `document_id`, `address_line`, `neighborhood`, `email`, `latitude`, `longitude`, `tags`, `observations`, `party_kind`. Values are `manual`, `bot`, or `import`.

`update_citizen_profile` sets `app.citizen_field_write = operator` and marks edited keys `manual`. A `BEFORE UPDATE` trigger, for any other writer, restores a column whose current source is `manual`. Empty fields may still be filled by the pet worker or a future import; the trigger then leaves the new value and does not invent a source (the writer may set `bot`). `whatsapp_push_name` is not a profile field and never writes `full_name`.

### D3 — Definer functions, not a wide UPDATE policy

Same reason as the inbox: an authenticated UPDATE lets an operator forge `registration_status` or `merged_into_id`. `update_citizen_profile`, `register_citizen`, `merge_citizens`, and `search_citizens` are `SECURITY DEFINER`, `search_path = ''`, and check `auth.uid()`. Authenticated clients get `EXECUTE` and no UPDATE on `citizens`. The service role may still insert the channel stub and update unprotected columns.

Hint codes: `FORBIDDEN`, `NOT_FOUND`, `INVALID_FIELD`, `ALREADY_REGISTERED`, `MISSING_FIELDS`, `MERGE_SELF`, `NOTE_REQUIRED`.

### D4 — Who can read and write

Any active operator, area lead, admin, or support in the organization can read citizens of that organization. A neighbor is not private to one area: the same phone can reach Mesa and Inspectoría. Support cannot execute the mutating functions. Another organization reads nothing.

### D5 — Timeline uses tables that exist

The ficha lists, newest first, inbound and outbound messages for the citizen's conversations, `conversation_events` for those conversations, and animals linked to the citizen. It does not query notes or tasks. Those tables are Phase 5.

### D6 — Search

`search_citizens(text)` matches `full_name`, `document_id`, or `phone_normalized` with case-insensitive contains, limit 20, and skips rows with `merged_into_id` set. Add `pg_trgm` and GIN indexes on `full_name` and `document_id` when the extension is missing. The page debounces input and calls the function. It does not load every citizen into the browser.

### D7 — Merge keeps the dropped row

`merge_citizens(keep, drop, note)` requires a non-empty note, two different ids in the caller's organization, and a drop that is not already merged. It moves `citizen_phones` (delete a phone the keeper already has), sets `conversations.citizen_id` and `animals.citizen_id` to the keeper, and sets `drop.merged_into_id`. It does not delete the drop row. Two threads on two phones stay two conversations under the keeper.

### D8 — Home coordinates

The ficha edits `citizens.latitude` and `citizens.longitude` and labels them "Domicilio / mascota". The thread inquiry pins stay on the message. Saving the ficha does not read message coordinates.

### D9 — Paths

| Layer | Paths |
|---|---|
| Presentation | `apps/web/src/presentation/citizens/**`, `(panel)/citizens/**`, a link from the inbox thread |
| Application | `apps/web/src/features/citizens/**` |
| Infrastructure | `apps/web/src/infrastructure/repositories/citizens.ts` |
| Contracts | `apps/web/src/contracts/citizens.ts` |
| Database | `supabase/migrations/20261108120000_pobladores_ficha.sql`, `supabase/tests/008_citizens_ficha.test.sql` |

Presentation components do not import Supabase. Copy is `es-AR`.

## Risks / Trade-offs

- The guard trigger is the only thing standing between the pet worker and a manual name. Tests must cover a service-role update that tries to replace a manual `full_name`.
- Search is contains-match, not fuzzy spelling. That matches "nombre, DNI o teléfono" at municipal size.
- Merge does not rewrite message bodies. History stays attached through `conversation_id`.
