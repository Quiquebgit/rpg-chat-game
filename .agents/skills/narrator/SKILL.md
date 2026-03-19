# Narrador IA — configuración y formato

## Modelos
- **Mecánicas:** Groq `llama-3.1-8b-instant` — JSON estricto, reglas del juego, function calling
- **Narrador:** Groq `llama-3.3-70b-versatile` — narrativa dramática, texto libre
- Clientes en `src/lib/groq.js`. System prompts en `src/lib/narrator.js`.

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
- `enemy_updates`: daño a enemigos en modo combat. enemy_id debe coincidir con el id en `game_mode_data.enemies`.
- `game_mode`: null (mantener) | "normal" | "combat" | "navigation" | "exploration" | "negotiation"
- `game_mode_data`: estructura completa del modo (reemplaza la anterior), o null para mantener.
- `inventory_updates`: SIEMPRE usar `getRandomItem(type, rarity)` vía function calling al añadir items. Nunca inventar.

## Contexto que recibe cada modelo en cada llamada
- Estado de todos los personajes presentes (HP, stats, inventario, habilidad)
- Resumen narrativo incremental de la sesión
- Modo de juego activo y datos del modo (enemigos, pistas, NPC...)
- Historial comprimido de los últimos 10 mensajes
- Acción del jugador actual

## Funciones especiales en useMessages.js
- `buildMechanicsPrompt(playerAction)` — prompt para el modelo mecánico (jugador en turno)
- `buildGmMechanicsPrompt(instruction)` — prompt GM, sin restricción de turno
- `buildNarratorPrompt(playerAction, mechanics, diceResult)` — prompt para el narrador
- `processAction(playerAction, { isGm, gmInstruction })` — orquesta mecánico → narrador
- `deliverNarrative(playerAction, mechanics, diceResult, { gmInstruction })` — llama narrador y aplica efectos
- `applyEnemyUpdates(enemyUpdates)` — aplica daño a enemigos, vuelve a normal si todos caen
- `applyGameMode(mechanics)` — actualiza game_mode en sesión, calcula iniciativa al entrar en combate
- `checkAndMarkDeaths(statUpdates)` — marca is_dead cuando HP llega a 0
- `rollInitiative()` — 1d6 + ataque del personaje, establece orden de combate cuando todos tiran

## Resumen narrativo incremental
- Se actualiza cada 10 mensajes de jugador
- Usa el modelo mecánico (8B) por coste mínimo
- Prompt: resumen actual + últimos 10 mensajes → resumen actualizado (máx 120 palabras)
- Se guarda en `sessions.narrative_summary`

## Comandos especiales
- `/acción texto` → `sendAction()` — emote visible, activa narrador si es tu turno
- `/gm instrucción` → `sendGmMessage()` — instrucción al narrador, funciona fuera de turno, la instrucción va en el system prompt del narrador con prioridad absoluta
