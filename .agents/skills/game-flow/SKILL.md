# Flujo de juego — sesiones y turnos

## Inicio de partida
1. `useSession` (en `App.jsx`) comprueba si hay sesión `active` en Supabase
2. Si la hay: modal **Continuar** / **Abandonar y empezar nueva**
3. Si no: crea sesión nueva con los 6 personajes en `session_character_state` (hp base, inventario vacío)
4. `CharacterSelect` muestra personajes; los reclamados (`claimed_by != null`) aparecen bloqueados en tiempo real
5. Al confirmar personaje: graba `claimed_by = playerId` en `session_character_state`

## Apertura automática del narrador
En sesiones nuevas (0 mensajes), `useMessages.loadMessages()` llama automáticamente a Groq para presentar la escena. Usa `openingRequestedRef` para evitar llamadas dobles.

## Dinámica de turnos
- `current_turn_character_id` en `sessions` indica quién debe actuar
- **El chat es libre:** todos pueden escribir en cualquier momento
- **Solo el jugador en turno activa al narrador.** El resto guarda mensaje pero no llama a Groq
- El narrador evalúa `is_action`:
  - `true` → narra + actualiza `current_turn_character_id` en Supabase
  - `false` → silencio, el turno no avanza
- El indicador de turno aparece bajo el último mensaje del narrador (ámbar si es el turno del jugador local)

## Gestión de sesiones
- `active` → continuar cargando historial de `messages`
- Nueva con activa existente → modal → marcar `abandoned` → crear nueva
- `finished` → cierre voluntario (post-MVP)
