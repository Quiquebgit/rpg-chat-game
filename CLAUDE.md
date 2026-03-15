# CLAUDE.md — RPG Chat Game (One Piece Universe)

## Descripción del proyecto
App web de rol multijugador cooperativo con chat en tiempo real, ambientada en un universo inspirado en One Piece pero con personajes y aventuras completamente originales. Un modelo de IA actúa como narrador/máster. Orientada a ser PWA.

## Stack tecnológico
- **Frontend:** React + Vite
- **Estilos:** Tailwind CSS v4 (via PostCSS)
- **Chat en tiempo real:** Supabase Realtime
- **Base de datos:** Supabase (PostgreSQL)
- **IA Narrador:** Groq API (`llama-3.3-70b-versatile`)
- **Deploy:** Vercel

## Variables de entorno
Fichero `.env` en la raíz. **Nunca subir al repositorio. Nunca mostrar su contenido.**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_GROQ_API_KEY`. Clientes en `src/lib/`.

## Estructura de carpetas
```
src/
├── components/     # CharacterCard, SessionModal
├── pages/          # CharacterSelect, GameRoom
├── hooks/          # useSession, useMessages
├── lib/            # supabase.js, groq.js, narrator.js
└── data/           # characters.js
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

### Pendiente
- [ ] Tirada de dados — botón en el chat, resultado visible para todos; el narrador lo solicita con `dice_required: true` y `dice_count`
- [ ] Actualización de vida automática cuando el narrador incluye `stat_updates` en su JSON
- [ ] Mostrar vida actualizada en el panel lateral de GameRoom en tiempo real

### Fuera del MVP
- Login y autenticación, avatares, personajes personalizados
- Pulido PWA / móvil, doc compartida de lore

## Reglas de desarrollo
- Cambios incrementales, no refactors grandes de golpe
- Comentarios en español, nombres de variables y funciones en inglés
- Antes de tocar algo que afecte a la estructura general, confirmar
- Cuando se añada una funcionalidad nueva, actualizar este CLAUDE.md

## Skills disponibles

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
| `/simplify` | Después de añadir código nuevo — revisa calidad y eficiencia |
| `/commit` | Para generar un commit con mensaje bien formateado |

## Convenciones de commits
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `chore:` configuración, dependencias
