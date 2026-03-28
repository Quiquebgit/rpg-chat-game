# AGENTS.md — RPG Chat Game (One Piece Universe)

## Descripción del proyecto
App web de rol multijugador cooperativo con chat en tiempo real, ambientada en un universo inspirado en One Piece pero con personajes y aventuras completamente originales. Un modelo de IA actúa como narrador/máster. Orientada a ser PWA.

## Stack tecnológico
- **Frontend:** React + Vite
- **Estilos:** Tailwind CSS v4 (via PostCSS)
- **Chat en tiempo real:** Supabase Realtime
- **Base de datos:** Supabase (PostgreSQL)
- **IA Mecánicas:** Groq API — JSON estricto, reglas del juego. Fallback: `llama-3.1-8b-instant` → `gpt-oss-20b` → `llama-4-scout`
- **IA Narrador:** Groq API — narrativa dramática, texto libre. Fallback: `llama-4-scout` → `llama-3.3-70b` → `kimi-k2` → ...
- **Deploy:** Vercel

## Variables de entorno
Fichero `.env` en la raíz. **Nunca subir al repositorio. Nunca mostrar su contenido.**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_GROQ_API_KEY`. Clientes en `src/lib/`.

## Estructura de carpetas
```
src/
├── components/     # GameModePanel, NarratorMessage, ChatMessages, DiceMessage,
│                   # PreGameScreen, InventoryPanel, CollapsibleAbility, StatRow, StatBoostPanel
├── pages/          # CharacterSelect, GameRoom, Lobby
├── hooks/          # useSession, useMessages, usePresence, useNarration, useDirector
├── lib/            # supabase.js, groq.js, narrator.js, items.js, enemies.js,
│                   # combat.js, prompts.js
└── data/           # characters.js, constants.js
```

## Estado actual del MVP
Sin login. Personajes predefinidos. Foco en que la dinámica funcione.

### Implementado
- [x] Selección de personaje con bloqueo en tiempo real (Realtime)
- [x] Chat en tiempo real entre jugadores (Supabase Realtime)
- [x] Narrador IA con apertura automática y sistema de turnos (Groq)
- [x] Panel lateral con estado del personaje (vida, stats, habilidad, inventario)
- [x] Gestión de sesiones (nueva, continuar, abandonar)
- [x] Identificación de jugadores por `playerId` en localStorage
- [x] Diseño responsive — panel colapsable en móvil

### Implementado (cont.)
- [x] Tirada de dados — botón visual con emojis de dado, resultado visible para todos
- [x] Actualización de vida automática con `stat_updates` en el JSON del narrador
- [x] Lobby con lista de sesiones, gestión (archivar, restaurar, borrar) y orden por actividad
- [x] Navegación por páginas: lobby → selección de personaje → sala de juego
- [x] Menú hamburguesa deslizante en GameRoom (pantalla de inicio / selección de personaje)
- [x] Comandos `/gm` y `/acción` disponibles para todos los jugadores
- [x] Liberar personajes bloqueados desde la pantalla de selección
- [x] Sistema de modos de juego: combat, navigation, exploration, negotiation
  - `game_mode` + `game_mode_data` en `sessions`, sincronizados en tiempo real para todos
  - `GameModePanel.jsx` muestra estado del modo activo (enemigos con HP, pistas, NPC...)
  - Modo combat: iniciativa (1d6+atk), orden de turno en combate, HP de enemigos, auto-vuelta a normal
  - Sistema de muerte: `is_dead` en `session_character_state`, personaje muerto solo puede chatear
  - Tintes de fondo según modo (rojo/azul/verde/dorado)
- [x] Combate robusto — daño calculado en código (no por el modelo):
  - `Math.max(0, atk - def)` para ataques y contraataques; el modelo nunca decide el daño real
  - Un solo enemigo dañado por turno; enemigos derrotados filtrados del contexto
  - `previewCombatAttack` calcula resultado antes de narrar; narrador recibe info real
  - `computeNextTurn` garantiza que el turno nunca va a un personaje muerto
  - Botín automático al acabar combate (`distributeLoot`): 70% por jugador, rareza aleatoria
- [x] Combate con frutas del diablo e inmunidades:
  - Stats efectivos en combate: base + bonos de equipo equipado + boosts del `game_mode_data`
  - Inmunidades por fruta: si el tipo de ataque enemigo está en `immune_to[]`, el personaje no recibe daño
  - Efectos especiales de fruta (`special_effect`) aplicados en turno de combate
  - Nuevo intent `stat_boost` en modelo mecánico: habilidades de buff a aliado (ej. Liderazgo de Darro)
- [x] Refactorización de código (sin cambios de lógica):
  - Constantes de estilo centralizadas en `src/data/constants.js`
  - Constructores de prompts extraídos a `src/lib/prompts.js` (factory `createPromptBuilders`)
  - Componentes UI extraídos de `GameRoom.jsx` a ficheros propios en `src/components/`
- [x] Fix presencia: jugador local presente de inmediato al entrar a la sala (sin esperar a Supabase Presence)
  - `usePresence` inicializa `presentIds` con el ID del jugador local; Presence añade los remotos al sincronizar
- [x] Segunda fruta del diablo — muerte instantánea fiel al lore:
  - Si el personaje ya tiene una fruta y intenta comer otra, se muestra un segundo modal con fondo rojo
  - Al confirmar, se llama `killCharacter` (nueva función en `useMessages`) que pone `hp_current: 0, is_dead: true`
  - La fruta no se consume — la muerte ocurre antes

### Pendiente

### Fuera del MVP
- Login y autenticación, avatares, personajes personalizados
- Pulido PWA / móvil, doc compartida de lore

## Reglas de desarrollo
- Cambios incrementales, no refactors grandes de golpe
- Comentarios en español, nombres de variables y funciones en inglés
- Antes de tocar algo que afecte a la estructura general, confirmar
- Cuando se añada una funcionalidad nueva, actualizar este AGENTS.md

## Skills disponibles

Los skills están en `.agents/skills/{nombre}/SKILL.md`. Esta es la única ubicación.

### De referencia — leer antes de tocar esas áreas
| Skill | Cuándo usarla |
|---|---|
| `/db-schema` | Antes de tocar BD, migraciones, o hooks de Supabase |
| `/game-flow` | Antes de tocar sesiones, turnos o flujo de entrada al juego |
| `/narrator` | Antes de tocar `narrator.js`, `useMessages` o la llamada a Groq |
| `/game-universe` | Antes de tocar `characters.js`, el system prompt o mecánicas de juego |

### De acción — invocar para realizar tareas
| Skill | Cuándo usarla |
|---|---|
| `/frontend-design` | Para mejorar el diseño visual de componentes o páginas |
| `/simplify` | Después de añadir código nuevo — revisa calidad y eficiencia |
| `/commit` | Para generar un commit con mensaje bien formateado |

## Convenciones de commits
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `chore:` configuración, dependencias
