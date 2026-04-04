---
name: game-flow
description: Referencia del flujo de juego — sesiones, turnos y modos. Leer antes de tocar sesiones, turnos o flujo de entrada al juego.
---

# Flujo de juego — sesiones, turnos y modos

## Inicio de partida
1. `Lobby.jsx` muestra sesiones existentes; el jugador puede entrar en una activa o crear nueva
2. Al crear: selecciona historia → dificultad → Director inicializa sesión con `session_character_state` (hp base, inventario vacío)
3. Si viene de "continuar con tripulación" (`continueFromSession`), se muestra un banner informativo y la sesión nueva hereda stats/inventario/XP
4. `CharacterSelect` muestra personajes; los reclamados por Presence aparecen bloqueados en tiempo real
5. Al confirmar personaje: graba `claimed_by = playerId` en `session_character_state`

## Presencia (usePresence.js)
- `presentIds` se inicializa con `[character.id]` al montar — el jugador local está presente de inmediato.
- Supabase Presence sincroniza los jugadores remotos asincrónicamente (~1-2s); `syncState` actualiza la lista.
- Esto garantiza que el botón "Zarpar" esté habilitado sin esperar a la suscripción de Presence.
- `participantIds` — jugadores que ya jugaron (marcados como participantes en el canal de Presence).
- `isParticipant` — persistido en `sessionStorage`; sobrevive navegación entre páginas.

## Sistema de espectadores
- Jugadores presentes al inicio de partida → participantes (pueden actuar)
- Jugadores que llegan tarde → espectadores (`isSpectator = hasStarted && !isParticipant`)
- Espectador puede unirse pulsando "Unirme a la aventura" → `announceEntry()` + `markAsParticipant()`
- Espectadores pueden sugerir acciones al jugador activo vía broadcast (`SPECTATOR_SUGGESTION`)
- Sugerencias aparecen como pills encima del input del jugador en turno; se limpian al cambiar turno
- Estado de participante persistido en `sessionStorage` con clave `participant_{session.id}_{char.id}`

## Dinámica de turnos
- `current_turn_character_id` en `sessions` indica quién debe actuar
- **El chat es libre:** todos pueden escribir en cualquier momento
- **Solo el jugador en turno activa al narrador.** El resto guarda mensaje pero no llama a Groq
- El toggle "Acción / Conversación" (solo visible al jugador en turno) determina si el narrador responde
- `/gm instrucción` funciona para cualquier jugador independientemente del turno
- `/acción texto` activa al narrador solo si es el turno de ese jugador

## Modos de juego
El modo activo se almacena en `sessions.game_mode` y se sincroniza en tiempo real para todos los clientes.

### Modo Combat
- Enemigos definidos en `game_mode_data.enemies[]` con HP, ataque, defensa, icono, `attack_type[]`
- `game_mode_data.boosts` — bonos de stat temporales por personaje: `{ [char_id]: { attack, defense } }`
- Al entrar en combate: cada jugador tira iniciativa (1d6 + ataque) → orden de turno
- Botón "Tirar iniciativa" reemplaza el input hasta que el jugador tire
- **Daño calculado en código** en `src/lib/combat.js → resolveCombatTurn()`:
  - Stats efectivos = base + equipo equipado + frutas activas + `game_mode_data.boosts`
  - Ataque: `Math.max(0, atk_efectivo - def_enemigo)`
  - Contraataque: `Math.max(0, atk_enemigo - def_efectiva)`. Si personaje es inmune al tipo de ataque → 0 daño.
  - Haki perfora siempre cualquier inmunidad.
- Intents del modelo mecánico: `attack | stat_boost | ability | heal | dodge | other`
  - `stat_boost` → aplica bonus en `game_mode_data.boosts` para el turno; no hace daño
  - `ability` con `use_special_ability: true` → activa `special_effect` de fruta (AoE, cegar, etc.)
- Solo un enemigo recibe daño por turno (salvo AoE). Código enforces esta regla.
- Enemigos derrotados (`defeated: true`) se filtran del contexto del modelo en turnos posteriores
- Todos los enemigos a 0 HP → `game_mode` vuelve a `'normal'` automáticamente + se distribuye botín
- **Botín automático** al acabar combate: 70% probabilidad por jugador, rareza aleatoria
- El siguiente turno es calculado por `computeNextTurn()` antes de narrar — nunca a un personaje muerto
- Fondo de interfaz: tinte rojo oscuro

### Modo Navigation
- `danger_name` + `danger_threshold`: riesgo marítimo a superar con dados de navegación
- Fondo: tinte azul marino

### Modo Exploration
- `clues[]`: lista de pistas que crece conforme se descubren
- Fondo: tinte verde

### Modo Negotiation
- `npc_name`, `npc_attitude` (hostile/neutral/friendly), `conviction` / `conviction_max`
- Fondo: tinte dorado

## Sistema de muerte
- Cuando `hp_current` llega a 0 → `is_dead = true` en `session_character_state`
- Personaje muerto: nombre tachado con ☠️ en sidebar, sin turno, solo puede chatear
- No puede enviar acciones ni tirar dados

## Gestión de sesiones
- `active` → continuar cargando historial de `messages`; botón "Invitar" copia URL con `?join=session_id`
- `abandoned` → archivada; se puede restaurar desde Lobby
- `finished` → sesión terminada; recap automático generado (`session_recap` JSONB); visible en tab "Historial" del Lobby

## Componentes clave
- `GameRoom.jsx` — sala de juego principal, orquesta todos los subcomponentes
- `GameModePanel.jsx` — panel superior con estado del modo activo (enemigos, pistas, NPC...)
- `useMessages.js` — toda la lógica de IA, modos de juego, combate, muerte
- `usePresence.js` — presencia, espectadores, participantes, sugerencias de espectadores
- `useReactions.js` — reacciones emoji en mensajes del narrador (tabla `message_reactions`)
- `useTurnNotification.js` — notificación "es tu turno" en pestaña del navegador
- `useFamilyMode.js` — modo familia (UI simplificada, persistido en localStorage)
