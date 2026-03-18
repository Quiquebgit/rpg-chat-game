# Esquema de base de datos — Supabase

Realtime habilitado en las tres tablas públicas.

## `sessions`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| created_at | timestamp | automático |
| status | text | `active` / `finished` / `abandoned` |
| current_turn_character_id | text | id del personaje al que le toca actuar |
| turn_order | text[] | orden base de turnos |

## `messages`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| created_at | timestamp | automático |
| session_id | uuid FK | referencia a `sessions` |
| character_id | text | id del personaje o `'narrator'` |
| content | text | texto del mensaje |
| type | text | `player` / `narrator` |

## `session_character_state`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| session_id | uuid FK | referencia a `sessions` |
| character_id | text | id del personaje |
| hp_current | int | vida actual |
| inventory | jsonb | array de items `{ name, type, effect }` |
| claimed_by | text | playerId del navegador que controla este personaje (nullable) |
| is_active | boolean | true si el jugador está conectado actualmente |

## Identificación de jugadores
Sin auth. Cada **pestaña** genera un `playerId` (UUID) persistido en `sessionStorage` (único por pestaña, persiste al refrescar, no se comparte entre pestañas). Se usa para reclamar personajes en `claimed_by`.

## Hooks relevantes
- `src/hooks/useSession.js` — gestión de sesión, `playerId`, `claimCharacter`
- `src/hooks/useMessages.js` — historial, Realtime, envío a Groq
