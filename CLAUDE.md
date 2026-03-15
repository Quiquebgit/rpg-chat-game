# CLAUDE.md — RPG Chat Game (One Piece Universe)

## Descripción del proyecto
App web de rol multijugador cooperativo con chat en tiempo real, ambientada en un universo inspirado en One Piece pero con personajes y aventuras completamente originales. Un modelo de IA actúa como narrador/máster. Orientada a ser PWA (instalable en móvil sin pasar por tiendas de apps).

## Stack tecnológico
- **Frontend:** React + Vite
- **Estilos:** Tailwind CSS v4
- **Chat en tiempo real:** Supabase Realtime
- **Base de datos:** Supabase (PostgreSQL)
- **IA Narrador:** Groq API (modelo: `llama-3.3-70b-versatile`)
- **Deploy:** Vercel

## Variables de entorno
Fichero `.env` en la raíz. **Nunca subir al repositorio. Nunca mostrar su contenido.**
Clientes configurados en `src/lib/supabase.js` y `src/lib/groq.js`.

## Universo del juego
Inspirado en One Piece pero con personajes y aventuras 100% originales. El narrador conoce el universo y lo usa sin que los jugadores necesiten conocerlo. Elementos clave:
- Piratas, marinos, islas, el Gran Line
- **Frutas del diablo:** objetos raros que aparecen durante las aventuras. Dan poderes únicos pero el portador pierde la capacidad de nadar. El grupo decide cooperativamente quién se la come. Ningún personaje empieza con una.
- **Haki:** energía espiritual que algunos personajes pueden desarrollar
- El mar es peligroso, los viajes tienen riesgos reales

## Sistema de stats
Números bajos al estilo del juego de mesa del Señor de los Anillos. Cada punto importa.

| Stat | Descripción |
|---|---|
| **Vida** | Puntos que pierdes al recibir daño |
| **Ataque** | Daño que haces en combate |
| **Defensa** | Reduce el daño recibido (ataque enemigo − defensa = vida perdida) |
| **Navegación** | Eficacia en viaje y exploración. Baja navegación + ruta peligrosa = penalización |

Cada personaje tiene además una **habilidad especial única** (no numérica).

## Personajes por defecto
Hardcodeados en `src/data/characters.js`. En el MVP son fijos; con login se podrán crear personajes personalizados.

## Inventario
Cada personaje tiene un inventario por sesión (no permanente). Tipos de items:
- **Frutas del diablo:** poder único, el portador no puede nadar
- **Armas:** modifican stats de ataque
- **Objetos:** efectos variados

Estructura JSONB: `{ "name": "...", "type": "fruta|arma|objeto", "effect": "..." }`

## Modelo de datos (Supabase)

### `sessions`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| created_at | timestamp | automático |
| status | text | `active` / `finished` / `abandoned` |
| current_turn_character_id | text | id del personaje al que le toca |
| turn_order | text[] | orden base de turnos |

### `messages`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| created_at | timestamp | automático |
| session_id | uuid FK | referencia a `sessions` |
| character_id | text | id del personaje o `'narrator'` |
| content | text | texto del mensaje |
| type | text | `player` / `narrator` |

### `session_character_state`
| campo | tipo | descripción |
|---|---|---|
| id | uuid PK | automático |
| session_id | uuid FK | referencia a `sessions` |
| character_id | text | id del personaje |
| hp_current | int | vida actual |
| inventory | jsonb | array de items |

## Flujo de juego

### Inicio de sesión
1. Pantalla de inicio: si hay sesión `active`, modal con **Continuar** o **Abandonar y empezar nueva**
2. Si no hay sesión activa, botón **Nueva sesión**
3. Al crear sesión nueva: se inicializa `session_character_state` con `hp_current` = hp base e inventario vacío
4. El narrador recibe el contexto y narra la apertura, interpelando al primer jugador

### Dinámica de turnos
- Orden base definido al crear la sesión en `turn_order`
- El narrador narra y decide a quién interpela (puede alterar el orden)
- El sistema actualiza `current_turn_character_id` tras cada acción
- En MVP el turno puede ser libre; la restricción estricta es post-MVP

### Gestión de sesiones
- Sesión `active`: se puede continuar cargando el historial de `messages`
- Nueva sesión con sesión activa: modal de confirmación → marcar como `abandoned` → crear nueva
- `finished`: el narrador o los jugadores cierran la aventura voluntariamente

## Groq — Configuración del narrador
- Modelo: `llama-3.3-70b-versatile`
- El narrador recibe en cada llamada:
  - Contexto del universo (One Piece original)
  - Estado actual de todos los personajes (hp, inventario, habilidades)
  - Historial reciente del chat
  - A quién le toca actuar
- Responde siempre en el idioma en que hablen los jugadores
- Tono: narrativo, dramático, propio de un máster de rol
- El narrador **no** juega por los personajes, solo narra consecuencias y eventos
- Conoce y aplica las reglas de stats (combate, navegación, habilidades especiales)

## Fase actual: MVP
Sin login. Personajes predefinidos. Foco en que la dinámica funcione.

### Funcionalidades MVP (en orden de prioridad)
1. Pantalla de selección de personaje
2. Chat en tiempo real entre jugadores (Supabase Realtime)
3. Narrador IA respondiendo en el chat (Groq)
4. Panel lateral con estado del personaje (vida, inventario, habilidad)
5. Gestión de sesiones (nueva, continuar, abandonar)
6. Tirada de dados integrada en el chat (comando `/dados Xd6`)

### Fuera del MVP
- Login y autenticación
- Avatares e imágenes de personaje
- Personajes personalizados
- Restricción estricta de turnos
- Pulido PWA / móvil
- Doc compartida de historia/lore

## Reglas de desarrollo
- Cambios incrementales, no refactors grandes de golpe
- Comentarios en español
- Nombres de variables y funciones en inglés
- Antes de tocar algo que afecte a la estructura general, confirmar
- Cuando se añada una funcionalidad nueva, actualizar este CLAUDE.md

## Skills de Claude disponibles
Estas skills están activas y se pueden invocar con `/nombre`:

| Skill | Cuándo usarla |
|---|---|
| `/simplify` | Después de añadir código nuevo — revisa calidad, reutilización y eficiencia |
| `/commit` | Para generar un commit con mensaje bien formateado |

## Convenciones de commits
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `chore:` configuración, dependencias
