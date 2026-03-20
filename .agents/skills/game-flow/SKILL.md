# Flujo de juego — sesiones, turnos y modos

## Inicio de partida
1. `useSession` (en `App.jsx`) comprueba si hay sesión `active` en Supabase
2. Si la hay: modal **Continuar** / **Abandonar y empezar nueva**
3. Si no: crea sesión nueva con los 6 personajes en `session_character_state` (hp base, inventario vacío)
4. `CharacterSelect` muestra personajes; los reclamados por Presence aparecen bloqueados en tiempo real
5. Al confirmar personaje: graba `claimed_by = playerId` en `session_character_state`

## Sistema de espectadores
- Jugadores presentes al inicio de partida → participantes (pueden actuar)
- Jugadores que llegan tarde → espectadores (solo ven el chat)
- Espectador puede unirse pulsando "Unirme a la aventura" → `announceEntry()` + `markAsParticipant()`
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
- Enemigos definidos en `game_mode_data.enemies[]` con HP, ataque, defensa, icono
- Al entrar en combate: cada jugador tira iniciativa (1d6 + ataque) → orden de turno
- Botón "Tirar iniciativa" reemplaza el input hasta que el jugador tire
- **Daño calculado en código**, no por el modelo. `hp_delta` del modelo se ignora.
  - Ataque jugador: `Math.max(0, atk_jugador - def_enemigo)`
  - Contraataque: `Math.max(0, atk_enemigo - def_jugador)` × enemigos vivos
- Solo un enemigo recibe daño por turno (salvo habilidad AoE). Código enforces esta regla.
- Enemigos derrotados (`defeated: true`) se filtran del contexto del modelo en turnos posteriores
- Todos los enemigos a 0 HP → `game_mode` vuelve a `'normal'` automáticamente + se distribuye botín
- **Botín automático** al acabar combate: 70% probabilidad por jugador, rareza aleatoria
- El siguiente turno es calculado por `computeNextTurn()` antes de narrar — nunca a un personaje muerto
- `gameModeRef` / `gameModeDataRef`: refs siempre actualizados, usados como fuente de verdad en combate
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
- `active` → continuar cargando historial de `messages`
- Nueva con activa existente → modal → marcar `abandoned` → crear nueva
- `finished` → cierre voluntario (post-MVP)

## Componentes clave
- `GameRoom.jsx` — sala de juego principal, orquesta todos los subcomponentes
- `GameModePanel.jsx` — panel superior con estado del modo activo (enemigos, pistas, NPC...)
- `useMessages.js` — toda la lógica de IA, modos de juego, combate, muerte
- `useSession.js` — gestión de sesión, suscripción a cambios en tiempo real
- `usePresence.js` — presencia, espectadores, participantes
