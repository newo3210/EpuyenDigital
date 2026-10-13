# Acceptance matrix — inspectoria-pet-registry-ux-v2

| # | Scenario | Expected | Covered by |
|---|---|---|---|
| 1 | New phone starts | Welcome (no consent), then full name | `state-machine.test` / `flow.test` |
| 2 | Citizen name → DNI → address | Advances to location help offer | `state-machine.test` |
| 3 | Location help `1` / Sí | Help text + `mediaPath` image, then ask location | `flow.test` (media outbound) |
| 4 | Location help `2` | Ask location without image | `state-machine.test` |
| 5 | Location pin | Coords stored → animal name | `state-machine.test` / `flow.test` |
| 6 | `No puedo ahora` | Continue without lat/lng | `state-machine.test` / `flow.test` |
| 7 | Rabies `3` / No sé | `rabiesStatus = unknown` | `state-machine.test` / `flow.test` |
| 8 | Health card `No` | Skip to animal photos | `state-machine.test` / adversarial |
| 9 | ≥1 photo then Listo/OK/any text | Completes; zero photos blocked | `state-machine.test` |
| 10 | Confirmation | Animal + citizen full name + `EPU-YYYY-SEQ5` | `flow.test` / i18n test |
| 11 | Returning citizen | Greeting by name; animal flow; EPU id | `flow.test` / adversarial |
| 12 | Session expiry | Reset to welcome, no stale animal | `state-machine.test` / `flow.test` |
