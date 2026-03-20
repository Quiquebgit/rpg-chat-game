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
- El `hp_delta` del modelo en `enemy_updates` es **ignorado**. El daño real se calcula en código: `Math.max(0, atk_jugador - def_enemigo)`.
- El contraataque también se calcula en código: `Math.max(0, atk_enemigo - def_jugador)` sumado entre todos los enemigos vivos.
- Esto garantiza que el daño sea siempre correcto aunque el modelo falle.
- El narrador recibe `attackPreview` con el resultado real antes de narrar, para ser coherente.

## Contexto que recibe cada modelo en cada llamada
- Estado de todos los personajes presentes (HP, stats, inventario, habilidad)
- Resumen narrativo incremental de la sesión
- Modo de juego activo y datos del modo (enemigos, pistas, NPC...)
- Historial comprimido de los últimos 10 mensajes
- Acción del jugador actual

## Funciones especiales en useMessages.js
- `buildMechanicsPrompt(playerAction)` — prompt para el modelo mecánico (jugador en turno)
- `buildGmMechanicsPrompt(instruction)` — prompt GM, sin restricción de turno
- `buildNarratorPrompt(playerAction, mechanics, diceResult, realNextId, attackPreview)` — prompt para el narrador; recibe el siguiente personaje real y el preview del ataque
- `buildGameModeContext()` — genera sección de modo activo para los prompts; en combate filtra enemigos derrotados
- `processAction(playerAction, { isGm, gmInstruction })` — orquesta mecánico → narrador
- `deliverNarrative(playerAction, mechanics, diceResult, { gmInstruction })` — llama narrador y aplica efectos
- `applyEnemyUpdates(enemyUpdates)` — aplica daño a **un solo** enemigo (código override), vuelve a normal si todos caen
- `applyGameMode(mechanics)` — actualiza game_mode en sesión, calcula iniciativa al entrar en combate
- `checkAndMarkDeaths(statUpdates)` — marca is_dead cuando HP llega a 0
- `rollInitiative()` — 1d6 + ataque del personaje, establece orden de combate cuando todos tiran
- `previewCombatAttack(enemyUpdates)` — calcula resultado real del ataque ANTES de narrar (enemyName, oldHp, newHp, damage, willBeDefeated, allWillFall)
- `computeNextTurn(mechanics)` — determina el próximo personaje vivo en turno; tiene prioridad sobre `next_character_id` del modelo
- `distributeLoot()` — otorga botín automáticamente al finalizar combate (70% por jugador, rareza aleatoria)

## Resumen narrativo incremental
- Se actualiza cada 10 mensajes de jugador
- Usa el modelo mecánico (8B) por coste mínimo
- Prompt: resumen actual + últimos 10 mensajes → resumen actualizado (máx 120 palabras)
- Se guarda en `sessions.narrative_summary`

## Comandos especiales
- `/acción texto` → `sendAction()` — emote visible, activa narrador si es tu turno
- `/gm instrucción` → `sendGmMessage()` — instrucción al narrador, funciona fuera de turno, la instrucción va en el system prompt del narrador con prioridad absoluta
