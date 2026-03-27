---
name: narrator
description: Referencia del sistema de narración IA, modelos, prompts y flujo de mensajes del RPG Chat Game. Leer antes de tocar narrator.js, useMessages o la llamada a Groq.
---

# Narrador IA — configuración y formato

## Modelos
- **Mecánicas:** `llama-3.1-8b-instant` → `openai/gpt-oss-20b` → `llama-4-scout-17b` (fallback por 429/503)
- **Narrador:** `llama-4-scout-17b` → `llama-3.3-70b-versatile` → `kimi-k2` → `qwen3-32b` → ... (fallback)
- Clientes en `src/lib/groq.js`. System prompts en `src/lib/narrator.js`.
- `tryModels()` itera la lista; solo avanza al siguiente modelo si recibe 429 o 503.

## Flujo de dos modelos
1. **Modelo mecánico** (`callMechanicsModel`) recibe acción del jugador → devuelve JSON con decisiones
2. Si `dice_required: true` → esperar tirada del jugador (botón en UI)
3. **Modelo narrador** (`callNarratorModel`) recibe acción + JSON mecánico → devuelve narrativa libre

## Formato JSON del modelo mecánico
```json
{
  "dice_required": false,
  "dice_count": 1,
  "dice_stat": "attack",
  "dice_threshold": 7,
  "next_character_id": "shin",
  "stat_updates": [{ "character_id": "darro", "hp_delta": -2 }],
  "inventory_updates": [{ "character_id": "shin", "action": "add", "item": {...} }],
  "enemy_updates": [{ "enemy_id": "enemy_1", "hp_delta": -3 }],
  "game_mode": "combat",
  "game_mode_data": {
    "enemies": [{ "id": "enemy_1", "name": "Soldado marino", "hp": 5, "hp_max": 5, "attack": 3, "defense": 2, "icon": "⚔️", "initiative": 4 }]
  },
  "event_type": "combat",
  "session_event": null
}
```

## Campos clave
- `enemy_updates`: daño a enemigos en modo combat. Formato `[{"enemy_id":<id exacto>,"hp_delta":<negativo>}]`. Solo un enemigo por turno salvo AoE explícita.
- `game_mode`: null (mantener) | "normal" | "combat" | "navigation" | "exploration" | "negotiation"
- `game_mode_data`: estructura completa del modo (reemplaza la anterior), o null para mantener.
- `inventory_updates`: SIEMPRE usar `getRandomItem(type, rarity)` vía function calling al añadir items. Nunca inventar.

## IMPORTANTE: daño calculado en código, no por el modelo
- El `hp_delta` del modelo en `enemy_updates` es **ignorado**. El daño real se calcula en código con stats efectivos (base + equipo + boosts).
- El contraataque también se calcula en código. Si el personaje es inmune al tipo de ataque del enemigo (`immune_to[]`), recibe 0 daño. Haki perfora siempre.
- El narrador recibe el `combatResult` (objeto con ataques, daños, defeats) calculado en código — nunca interpreta el JSON crudo del modelo mecánico.
- Intent `stat_boost` (ej. Liderazgo de Darro): aplica bonus de stat a un aliado vía `game_mode_data.boosts`; no hace daño.

## Contexto que recibe cada modelo en cada llamada
- Estado de todos los personajes presentes (HP, stats, inventario, habilidad)
- Resumen narrativo incremental de la sesión
- Modo de juego activo y datos del modo (enemigos, pistas, NPC...)
- Historial comprimido de los últimos 10 mensajes
- Acción del jugador actual

## Constructores de prompts — src/lib/prompts.js

Los builders de prompt están en `src/lib/prompts.js`, NO en `useMessages.js`.
Se instancian con un factory al inicio de cada render de `useMessages`:

```js
const { buildMechanicsPrompt, buildNarratorPrompt, ... } =
  createPromptBuilders({ activeCharacter, presentIdsRef, characterStatesRef, messagesRef, narrativeSummaryRef, sessionRef })
```

Los refs se pasan como objetos estables; las funciones acceden a `.current` en el momento de la llamada. `activeCharacter` se pasa como valor (el factory se re-ejecuta en cada render para mantenerlo actualizado).

Builders disponibles:
- `buildMechanicsPrompt(playerAction, gameModeData, gameMode)` — prompt mecánico fuera de combate
- `buildCombatMechanicsPrompt(playerAction, gameModeData)` — prompt mecánico en combate (incluye estado de habilidad, frutas, inmunidades)
- `buildGmMechanicsPrompt(instruction, gameModeData, gameMode)` — prompt GM
- `buildNarratorPrompt(playerAction, mechanics, diceResult, realNextId)` — narrador fuera de combate
- `buildNarratorCombatPrompt(combatResult, nextTurnId, gameModeData)` — narrador en combate
- `buildNavigationNarratorPrompt(rollTotal, accumulated, threshold, completed, usedAbility)` — narrador navegación
- `buildCharacterContext()` — contexto completo de personajes presentes
- `buildMinimalCharContext()` — contexto compacto para modelo mecánico
- `buildEventContext()` — contexto del evento activo; si `currentEventSetup.type === 'combat'|'boss'`, emite instrucción imperativa: `"ACTIVA game_mode:combat con getEnemies() AHORA"` en lugar de texto ambiguo. Requiere `currentEventSetupRef` en el factory.
- `buildBeatContext()` — objetivo narrativo del beat actual (Director de Guion)
- `getLeastActive()` / `getDefaultMechanics()` — helpers de turno

## Funciones especiales en useMessages.js
- `processCombatAction(playerAction, gameModeData)` — orquesta mecánico → resolver turno en código → narrar
- `resolveCombatTurn(...)` — en `src/lib/combat.js`; calcula daño con stats efectivos (equipo + boosts + frutas)
- `applyStatUpdates(updates)` — aplica `hp_delta` a personajes en Supabase
- `applyInventoryUpdates(updates)` — add/remove items del inventario en Supabase
- `checkAndMarkDeaths(affectedIds)` — marca is_dead cuando HP llega a 0
- `rollInitiative()` — 1d6 + ataque del personaje, establece orden de combate cuando todos tiran
- `rollNavigation(useAbility)` — tirada de navegación; bonus de habilidad: `ability?.effect?.value ?? ability?.value ?? 3`
- `distributeLoot()` — botín automático al finalizar combate (70% por jugador, rareza aleatoria)
- `startGame()` — genera apertura narrativa; llama a `buildCharacterContext()` que usa `presentIdsRef.current`
- `announceEntry()` — mensaje de entrada para jugadores tardíos (espectadores)

## Resumen narrativo incremental
- Se actualiza cada 10 mensajes de jugador
- Usa el modelo mecánico (8B) por coste mínimo
- Prompt: resumen actual + últimos 10 mensajes → resumen actualizado (máx 120 palabras)
- Se guarda en `sessions.narrative_summary`

## Comandos especiales
- `/acción texto` → `sendAction()` — emote visible, activa narrador si es tu turno
- `/gm instrucción` → `sendGmMessage()` — instrucción al narrador, funciona fuera de turno, la instrucción va en el system prompt del narrador con prioridad absoluta
