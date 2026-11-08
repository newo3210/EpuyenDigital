# Acceptance matrix — chatbot-llm (BOT)

| Criterion | Evidence | Result |
|---|---|---|
| Knowledge tables + chunks + bot_runs | migration + Vitest SQL contract | PASS (static) |
| Admin knowledge upsert / support forbidden | `010_chatbot_llm.test.sql` | GAP live (NO_DOCKER); static PASS |
| Authenticated cannot write bot_runs | revoke + pgTAP | GAP live (NO_DOCKER); static PASS |
| Dual enqueue process_inbound + bot_reply (non-audio) | inbound repository test | PASS |
| Audio: transcribe first, then bot_reply | inbound + transcribe job | PASS (unit) |
| External contacts bypass both jobs | inbound repository test | PASS |
| Silent on open pet session / pause / owner / empty text | `decideBotReply` + `bot-reply` tests | PASS |
| Privacy once, handoff ack once, clarify once | `bot-decision` unit tests | PASS |
| Resolve respects org `bot_paused` | migration `resolve_conversation` patch | PASS (static) |
| Outbound `sender_kind=bot` | send_outbound + persistOutbound | PASS (code) |
| Admin knowledge UI + pause + activate/reindex | `/settings/knowledge` | PASS (text corpus MVP; PDF upload deferred) |
| Thread bot_runs panel with sources | inbox thread | PASS (code) |
| Field extraction confirm→write (D6) | proposed fields in `bot_runs` only | GAP — citizen write deferred |
| Embeddings / chat LLM RAG | trigram/text retrieval MVP | GAP — intentional MVP; embeddings deferred |
| Classification topic/urgency/area | not auto-applied to area_id | GAP — advisory fields deferred |
| Real STT / media vision summary | stub jobs | GAP |
| Docs (ARCHITECTURE / STUDENT / data-model) | root + docs | PASS |
| Live curl / browser / pgTAP / pgvector | reports 5.2–5.4 | GAP (NO_DOCKER) |
| Do not gate process_inbound by area | inbound unchanged except dual enqueue | PASS |
| Do not auto-set area_id from bot | bot_reply has no area update | PASS |
