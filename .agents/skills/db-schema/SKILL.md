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
| narrative_summary | text | resumen incremental de la sesión (actualizado cada 10 mensajes) |
| game_mode | text | `normal` / `combat` / `navigation` / `exploration` / `negotiation` (default: `normal`) |
| game_mode_data | jsonb | datos del modo activo (enemigos, pistas, NPC, etc.) — ver estructura abajo |

### `game_mode_data` por modo
- **combat**: `{ enemies: [{ id, name, hp, hp_max, attack, defense, icon, initiative, defeated }], initiative: { char_id: roll }, combat_turn_order: [char_id] }`
- **navigation**: `{ danger_name, danger_threshold, progress }`
- **exploration**: `{ clues: [] }`
- **negotiation**: `{ npc_name, npc_attitude ("hostile"|"neutral"|"friendly"), conviction, conviction_max }`

## `messages`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| created_at | timestamp | automático |
| session_id | uuid FK | referencia a `sessions` |
| character_id | text | id del personaje o `'narrator'` |
| content | text | texto del mensaje |
| type | text | `player` / `narrator` / `action` / `gm` / `dice` / `ooc` |

## `session_character_state`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| session_id | uuid FK | referencia a `sessions` |
| character_id | text | id del personaje |
| hp_current | int | vida actual |
| inventory | jsonb | array de items `{ name, type, rarity, effect, effects[], special_ability, cure_description, is_negative }` |
| claimed_by | text | playerId del navegador que controla este personaje (nullable) |
| is_active | boolean | true si el jugador está conectado actualmente |
| is_dead | boolean | true si el personaje llegó a 0 HP (default: false) |

## `items`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| name | text | nombre único del item |
| type | text | `arma` / `equipo` / `consumible` / `fruta` |
| rarity | text | `común` / `raro` / `único` |
| is_negative | boolean | true si es un item negativo (veneno, trampa...) |
| description | text | descripción narrativa corta (max ~10 palabras) |
| effects | jsonb | array de `{ stat, modifier }` — efectos mecánicos |
| special_ability | text | descripción de habilidad especial (nullable) |
| cure_difficulty | text | `easy` / `normal` / `hard` (nullable, solo items negativos) |
| cure_description | text | cómo curar el efecto (nullable, solo items negativos) |

## Identificación de jugadores
Sin auth. Cada **pestaña** genera un `playerId` (UUID) persistido en `sessionStorage` (único por pestaña, persiste al refrescar, no se comparte entre pestañas). Se usa para reclamar personajes en `claimed_by`.

## Hooks relevantes
- `src/hooks/useSession.js` — gestión de sesión, `playerId`, `claimCharacter`
- `src/hooks/useMessages.js` — historial, Realtime, envío a Groq, modos de juego
