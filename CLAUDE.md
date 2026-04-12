# RPG Chat Game — One Piece Universe

## Descripción
Juego de rol multijugador cooperativo con chat en tiempo real. Un modelo IA actúa como narrador/máster. Universo inspirado en One Piece con personajes y aventuras 100% originales. PWA-ready.

## Stack
- **Frontend:** React 19 + Vite 8 — `npm run dev` (puerto 5174)
- **Estilos:** Tailwind CSS v4 via PostCSS
- **BD + Realtime:** Supabase (PostgreSQL + Realtime + Presence)
- **IA Mecánicas (JSON):** Groq — `llama-3.1-8b-instant` → fallback chain
- **IA Narrador (texto):** Groq — `llama-4-scout` → `llama-3.3-70b` → `kimi-k2`
- **IA Director (eventos):** Groq — `kimi-k2` → `gpt-oss-120b` → `llama-3.3-70b`
- **Voz:** Google Cloud TTS (`es-ES-Neural2-B`) · fallback Web Speech API
- **PWA:** vite-plugin-pwa + Workbox (service worker, manifest, offline fallback)
- **Deploy:** Vercel

## Variables de entorno
Fichero `.env` en la raíz. **Nunca subir al repo. Nunca mostrar su contenido.**
```
VITE_SUPABASE_URL
VITE_SUPABASE_KEY
VITE_GROQ_API_KEY
VITE_GOOGLE_TTS_API_KEY   # opcional — sin ella usa Web Speech API
```

## Estructura de carpetas
```
src/
├── components/   # UI reutilizable (GameModePanel, DiceMessage, InventoryPanel,
│                 # BitacoraPanel, ShopPanel, WantedPosterCard, ContinuePicker…)
├── pages/        # Landing, CharacterSelect, GameRoom, Lobby
├── hooks/        # useSession, useMessages, usePresence, useNarration, useDirector, useTheme
│                 # useReactions, useTurnNotification, useFamilyMode
├── lib/          # supabase.js · groq.js · narrator.js · prompts.js · combat.js
│                 # director.js · items.js · enemies.js · worldState.js · recap.js
├── styles/       # themes.css · animations.css · typography.css · utilities.css
└── data/         # characters.js · constants.js · stories/*.md
```

---

## Sistema de diseño

### Arquitectura CSS
Los estilos están separados en `src/styles/`. **Nunca usar colores Tailwind hardcodeados** (`bg-gray-900`, `text-amber-400`…) — siempre usar los tokens del `@theme`.

```
src/styles/
├── themes.css      ← Variables CSS: dark "Grand Line Night" + light "Dawn Island"
├── animations.css  ← @keyframes: dice-roll, scale-in, dot-bounce, glow-pulse, mode-flash…
├── typography.css  ← Cinzel (display) + Inter (body)
└── utilities.css   ← Transición suave al cambiar tema
```

### Temas
Dos temas controlados por `data-theme` en `<html>`. El hook `useTheme` (persistido en `localStorage` como `op-theme`) y el componente `<ThemeToggle />` gestionan el toggle manual y la detección de `prefers-color-scheme`.

| Tema | Activación | Descripción |
|---|---|---|
| Grand Line Night | `data-theme="dark"` | Carbón negro + oro brillante |
| Dawn Island | `data-theme="light"` | Pergamino cálido + tinta oscura |

### Tokens — referencia rápida
| Utilidad Tailwind | Uso |
|---|---|
| `bg-canvas` / `bg-panel` / `bg-raised` / `bg-float` | Fondos por elevación |
| `text-ink` / `text-ink-2` / `text-ink-3` / `text-ink-off` | Texto: principal → hint |
| `border-stroke` / `border-stroke-2` / `border-stroke-3` | Bordes por intensidad |
| `bg-gold` / `text-gold` / `text-gold-bright` / `text-gold-dim` | Acento oro (ambos temas) |
| `bg-combat` / `bg-navigation` / `bg-exploration` / `bg-negotiation` | Color por modo de juego |
| `text-combat-light` / `text-navigation-light` / … | Texto claro sobre fondo de modo |
| `bg-stat-attack` / `bg-stat-defense` / `bg-stat-navigation` / `bg-stat-dexterity` / `bg-stat-charisma` | Color por stat |
| `bg-item-fruta` / `bg-item-arma` / `bg-item-equipo` / `bg-item-consumible` | Color por tipo de item |
| `bg-hp-high` / `bg-hp-medium` / `bg-hp-low` | Barra de HP dinámica |
| `text-degree-crit-success` / `text-degree-success` / `text-degree-failure` / `text-degree-crit-failure` | Grados de tirada |

Para opacidades: `bg-gold/10`, `border-combat/30` — Tailwind v4 usa `color-mix()` automáticamente.
Para efectos en `style={{}}`: usar `var(--mode-combat-flash)`, `var(--gradient-lobby)`, nunca `rgba()` hardcodeado.

### Reglas de diseño
- ❌ Nunca `bg-gray-*`, `text-amber-*` u otros colores Tailwind hardcodeados en JSX
- ❌ Nunca `rgba(220,38,38,0.3)` en `style={{}}` — usar `var(--mode-combat-flash)`
- ❌ Nunca lógica `if (darkMode)` en componentes — el CSS lo resuelve solo
- ✅ Para glow/shadow con color dinámico: `color-mix(in srgb, var(--degree-crit-success) 35%, transparent)`
- ✅ `text-ink-off` solo para decoración/hints — texto que el usuario lea: mínimo `text-ink-3`

---

## Skills — navegación para agentes

### Leer ANTES de tocar estas áreas
| Área | Skill | Archivos clave afectados |
|---|---|---|
| Base de datos, migraciones, RLS | `/db-schema` | supabase.js, tablas Supabase |
| Sesiones, turnos, modos de juego, presencia | `/game-flow` | useSession, usePresence, GameRoom.jsx |
| Narración IA, prompts, llamadas a Groq | `/narrator` | narrator.js, prompts.js, groq.js, useMessages.js |
| Personajes, stats, combate, inventario, frutas, bounties, títulos | `/game-universe` | characters.js, combat.js, constants.js |
| Sistema de tiradas y mecánicas de acción | `/action-system` | DiceMessage.jsx, useMessages.js, combat.js |
| Diseño visual, colores, tipografía, animaciones | `/frontend-design` | components/*, pages/*, constants.js |
| Lore, historias, universo, personajes del mundo | `/lore-one-piece` | stories/*.md, narrator.js |
| Mundo persistente, NPCs, mapa, ubicaciones | `/db-schema` | worldState.js, world_npcs/world_locations tables, BitacoraPanel.jsx |

### Invocar para realizar tareas
| Tarea | Skill |
|---|---|
| Mejorar diseño visual de un componente | `/frontend-design` |
| Crear animaciones CSS/canvas (dados, transiciones) | `/canvas-design` |
| Crear o cambiar tema visual (colores, tipografía) | `/theme-factory` |
| Escribir tests para componentes React | `/webapp-testing` |
| Revisar componentes React: rendimiento y patrones | `/vercel-react-best-practices` |
| Refactorizar composición de componentes escalable | `/vercel-composition-patterns` |
| Directrices de diseño web (layout, spacing, UX) | `/web-design-guidelines` |
| Auditoría de accesibilidad y calidad de código | `/audit` |
| Revisar calidad y eficiencia del código añadido | `/simplify` |
| Generar commit bien formateado | `/commit` |
| Crear un nuevo skill para este proyecto | `/skill-creator` |
| Descubrir o instalar nuevas capacidades | `/find-skills` |

---

## Reglas de desarrollo
- **Cambios incrementales** — no refactors grandes sin confirmar
- **Idioma:** comentarios en español, variables y funciones en inglés
- **Seguridad:** nunca exponer API keys; siempre variables de entorno
- **IA y daño:** el daño en combate SIEMPRE se calcula en código (`combat.js`), nunca lo decide el modelo
- Al añadir funcionalidad nueva, actualizar este CLAUDE.md y el skill relevante
- **ROADMAP obligatorio:** al terminar cualquier sprint, bug o tarea, marcar las tareas completadas en [ROADMAP.md](ROADMAP.md) con `[x]`. Esto es crítico para que futuros agentes sepan exactamente qué está hecho y qué queda pendiente.
- **Commits y push obligatorios:** al terminar cualquier tarea o subtarea, hacer commit de los cambios con `/commit` y push inmediatamente. Agrupar por funcionalidad (no un commit por fichero). Incluir siempre los ficheros de documentación afectados (CLAUDE.md, ROADMAP.md, skills).

## Convenciones de commits
```
feat:     nueva funcionalidad
fix:      corrección de bug
refactor: refactorización sin cambio de comportamiento
style:    cambios visuales / CSS
content:  nuevas historias, personajes, datos de lore
chore:    configuración, dependencias, scripts
docs:     solo documentación (CLAUDE.md, ROADMAP.md, skills)
```

---

## Estado actual del proyecto
Ver [ROADMAP.md](ROADMAP.md) para el plan completo de sprints.

**MVP funcional implementado:**
- Chat en tiempo real + narrador IA con sistema de turnos
- 4 modos de juego: combat · navigation · exploration · negotiation
- Motor de combate determinista (daño calculado en código, nunca por IA)
- Frutas del diablo con inmunidades y efectos especiales
- Sistema de inventario con items equipables
- Director narrativo con árbol de eventos y beats
- Síntesis de voz (Google TTS + fallback Web Speech)
- 6 personajes fijos con habilidades únicas · 7 historias disponibles (tabla `stories` en Supabase)
- Lobby, selección de personaje, presencia en tiempo real
- Bugs B1+B2 corregidos al 100%: Liderazgo (selector ATK/DEF) + Tratamiento (HealPanel) + boost visible en stats + iniciativa consistente
- Sprint 1 completado al 100%: `checkDegree`, `skill_check`, `support_roll`, consecuencias mecánicas por grado, desafíos sostenidos, acciones triviales/imposibles, DiceMessage con grado visual
- Sprint 2 completado al 100%: dexterity+charisma en personajes y prompts, economía de berries (money/XP en BD), bounty de jugadores y enemigos, progresión por XP con modal de stat-up, calculateXpReward/calculateMoneyReward en combat.js
- Sprint 3 completado al 100%: CharacterPanel con tabs (Personaje/Poderes/Mochila) + bottom sheet mobile, fuente Cinzel, @keyframes dice-roll/scale-in/dot-bounce/glow-pulse/mode-flash, DiceMessage animado, typing indicator 3 puntos, GameModePanel mejorado (bounty badge, grayscale derrotados, glow-pulse turno), CharacterSelect con barras de stats, Lobby con gradiente épico
- Sistema de diseño completado: paleta One Piece completa (dark Grand Line Night + light Dawn Island), tokens CSS en `src/styles/themes.css`, hook `useTheme` + `ThemeToggle`, migración total de todas las clases Tailwind hardcodeadas a tokens semánticos en todos los componentes y páginas, correcciones de contraste WCAG en ambos temas
- Sprint 4 completado al 100%: tabla `stories` en Supabase + seed 7 historias (3 originales + 4 nuevas), `loadStory()` en director.js, Lobby carga historias desde BD, `StoryEditor.jsx` para historias personalizadas, modal fin de aventura con `continueWithCrew` (preserva XP/berries/inventario/stat_upgrades), `rollNavigationEvent()` con trigger ~12% por tirada
- Sprint 5 completado al 100%: mundo persistente con tablas `world_npcs` + `world_locations` + `world_location_connections`, jerarquía de Marina generada por IA (~16 NPCs), tool calling `saveWorldNpc`/`saveWorldLocation` para persistencia automática, `buildWorldContext()` en prompts, derrota de NPCs marcada en BD, Director sugiere destinos coherentes con ubicaciones existentes. (Nota: los paneles "Enemigos conocidos" y mapa SVG se movieron de Lobby a `BitacoraPanel` en GameRoom en Sprint 7)
- Sprint 6 completado al 100%: link de invitación (`?join=session_id`) con `CopyLinkButton`, reacciones emoji en mensajes del narrador (tabla `message_reactions` + `useReactions` + `ReactionBar`), sugerencias de espectadores vía broadcast (`SpectatorSuggestInput` + `SuggestionPills`), recap automático al terminar sesión (`recap.js` + `SessionRecapModal` + columna `session_recap`), notificación "es tu turno" en pestaña (`useTurnNotification`), panel historial en Lobby con `SessionHistoryCard` (evolucionado a 4 tabs en Sprint 7), modo familia (`useFamilyMode` + `FamilyModeToggle`, simplifica CharacterPanel/GameModePanel/DiceMessage)
- Sprint 7 completado al 100%: Menú principal con 4 pestañas (activas/terminadas/archivadas/Salón de la Fama), mundo persistente por sesión (`session_id` en `world_npcs`/`world_locations`), `BitacoraPanel.jsx` en GameRoom con Realtime y 4 tabs (Enemigos/Mapa/Tripulación/Tienda), flujo "Continuar la aventura" inline sin salir de GameRoom (`ContinuePicker.jsx` + `handleContinueInline`), pestaña Terminadas rediseñada con mismo layout que Activas, estados vacíos informativos en Bitácora
- Sprint 7b completado al 100%: Progresión entre sesiones — suministros del barco (`supplies_days` en sessions, consumo por navegación, indicador en GameModePanel, crisis a 0 días), bounties dinámicos (`bounty_current` en session_character_state, `calculateBountyIncrease` en combat.js, delta visible en CharacterPanel), títulos de personaje (12 títulos en `TITLES_CATALOG`, `checkAndGrantTitles` en combat.js, `achievement_counters` JSONB, título visible bajo nombre en chat), reputación de tripulación (`crew_reputation` en sessions, RPC `increment_crew_reputation`, badge en tarjetas Lobby, niveles Novatos/Conocidos/Legendaria en Bitácora), tienda (`ShopPanel.jsx` con items con precio, `buyItem` en useMessages.js), carteles de búsqueda (`WantedPosterCard.jsx`), herencia completa al continuar tripulación (bounty, títulos, achievement_counters, supplies, reputación)
- Sprint 8 completado al 100%: PWA instalable (`vite-plugin-pwa` + Workbox + manifest + iconos 192/512 + `offline.html`), contexto cross-session para el Director (`parent_session_id` en sessions, `getCrossSessionLocations()` en worldState.js, `buildWorldContext()` incluye ubicaciones de sesiones anteriores), Web Notifications API para turnos (notificación nativa + fallback title flash), Landing page (`Landing.jsx` con hero + features + CTA), code splitting con `React.lazy()` (bundle 643KB → 248KB + chunks), Google Fonts optimizado (preconnect + `<link>` en HTML), `vercel.json` con SPA rewrite, `.env.example`, README reescrito

**Estado:** Juego lanzado como PWA. Ver Backlog en ROADMAP.md para ideas post-lanzamiento.
