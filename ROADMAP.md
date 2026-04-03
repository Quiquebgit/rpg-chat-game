# ROADMAP — RPG Chat Game

> **Objetivo:** Transformar el MVP funcional en un juego de rol épico, adictivo y memorable para jugar con amigos y familia. Cada sprint tiene un objetivo de **experiencia de jugador** claro, tareas concretas, y análisis de paralelización para ejecutar con agentes.

---

## Estado actual (post-Sprint 0)

- ✅ Chat en tiempo real + narrador IA con turnos
- ✅ 4 modos de juego (combat, navigation, exploration, negotiation)
- ✅ Motor de combate determinista (daño en código)
- ✅ Frutas del diablo, inmunidades, efectos especiales
- ✅ Inventario, items equipables, botín automático
- ✅ Director narrativo con árbol de eventos
- ✅ Síntesis de voz (Google TTS + Web Speech)
- ✅ 6 personajes · 3 historias · Lobby funcional

---

## 🐛 Bugs activos — corregir antes o durante Sprint 1

Estos bugs se pueden abordar en paralelo a cualquier sprint, ya que tocan áreas acotadas.

### Bug 1 — Habilidades especiales no ejecutan su efecto ✅ RESUELTO
**Síntoma:** El narrador narra que se usa la habilidad, pero el efecto no se aplica.
- Liderazgo (Darro): no muestra la mejora al aliado afectado, falta botón para elegir ATK o DEF
- Tratamiento (Vela): no funciona; debería funcionar igual que Liderazgo pero para heal
- Las demás habilidades (Emboscada, Lectura del mar, Festín) están sin verificar

**Tareas:**
- [x] Revisar `resolveCombatTurn()` en `combat.js` — `stat_boost` y `heal` ya se aplicaban; corregido uso de `mechanics.selected_stat`
- [x] Liderazgo: `StatBoostPanel` ahora muestra selector ATK/DEF antes de elegir aliado; `characters.js` añade `stat_choices`
- [x] Mostrar en el panel del aliado afectado el boost activo — `combatBoosts` sumado a `StatRow` en GameRoom
- [x] Tratamiento: nuevo `HealPanel` en `StatBoostPanel.jsx`; visible en combate cuando `ability.type === 'heal'`
- [x] Valorar limitador de usos por combate/sesión — **decidido: no necesario con el set actual**. Liderazgo y Emboscada ya tienen limitador; el coste de turno balancea el resto. Usar `combat_ability_used` para habilidades futuras que lo requieran.

**Archivos:** `src/lib/combat.js` · `src/hooks/useMessages.js` · `src/components/GameModePanel.jsx` · `src/components/StatBoostPanel.jsx`  
**Skills a leer:** `/game-universe` · `/game-flow`

### Bug 2 — Iniciativa inconsistente en combate ✅ RESUELTO
**Síntoma:** Si un jugador entra al combate después de que ha comenzado y tira iniciativa, el cálculo mezcla tiradas anteriores y el turno se asigna mal.

**Tareas:**
- [x] Prohibir unirse al combate una vez iniciado: `needsInitiativeRoll` ahora comprueba que `combat_turn_order` no exista; los jugadores tardíos ven mensaje explicativo
- [x] `rollInitiative()` en `useMessages.js` — ya solo actúa cuando `game_mode === 'combat'`; el guard de `combat_turn_order` impide duplicados
- [x] Validar que `computeNextTurn()` nunca asigna turno a personajes que no han tirado iniciativa — filtra por `initiative` keys antes de rotar

**Archivos:** `src/hooks/useMessages.js` · `src/pages/GameRoom.jsx`  
**Skills a leer:** `/game-flow`

---

## Olas de ejecución (paralelización entre sprints)

```
BUGS   ─── Bug fixes (paralelo con cualquier sprint)

OLA 1  ─── Sprint 1 (Tiradas)  ──┐
        └── Sprint 3 (UI/UX)   ──┘ → paralelos

OLA 2  ─── Sprint 2 (Personaje + Economía) ──┐
        └── Sprint 4 (Contenido + Historias) ──┘ → paralelos

OLA 3  ─── Sprint 5 (Mundo Persistente: Marina + Mapa)

OLA 4  ─── Sprint 6 (Social y Engagement)

OLA 5  ─── Sprint 7 (Progresión entre sesiones)

OLA 6  ─── Sprint 8 (PWA y Lanzamiento)
```

---

## Sprint 1 — Sistema de Tiradas Real ✅ COMPLETADO (todas las tareas)
**Experiencia objetivo:** *"¡Voy a intentar colarme por la ventana antes del ataque! ¿Tiro para eso?"* — el jugador siente que cualquier acción creativa tiene peso real y consecuencias dramáticas.

### Tareas
- [x] Añadir `skill_check` intent al prompt del modelo mecánico (`narrator.js`) — incluye `skill_stat` y `skill_dc`
- [x] Función pura `checkDegree(total, dc)` en `combat.js` — grados: `critical_success / success / failure / critical_failure` (margen ±4)
- [x] Pausa para skill_check en `useMessages.js` — combate se pausa, se pide tirada, se narra con grado en `combatResult.skill_check_result`
- [x] Tirada de apoyo: `support_roll` en combate y modo normal → `supportBonusRef` acumula +3 para la siguiente tirada
- [x] Desafíos sostenidos: estado `sustained_challenge` en `game_mode_data`; progreso acumulado éxitos/fallos; botón de tirada persistente en GameRoom
- [x] `DiceMessage.jsx` — muestra DC, stat, resultado y grado con color (dorado/verde/rojo)
- [x] El narrador recibe grado en `combatResult`, nunca números crudos
- [x] Consecuencias mecánicas por grado: éxito crítico → +1 stat temporal en `gameModeData.boosts`; fallo crítico → -1 HP al jugador activo
- [x] Acciones triviales/imposibles: `action_result:"trivial"|"impossible"` en el modelo → sin tirada, narración automática

### Archivos afectados
`src/lib/narrator.js` · `src/lib/prompts.js` · `src/lib/combat.js` · `src/hooks/useMessages.js` · `src/components/DiceMessage.jsx`

### Skills a leer
`/action-system` · `/narrator` · `/game-universe`

### Paralelización
**⚡ PARALELIZABLE con Sprint 3** — Sprint 3 toca solo componentes UI y estilos.  
**⚡ PARALELIZABLE con Sprint 4** — Sprint 4 toca solo contenido y director.  
**🚫 NO paralelizar con Sprint 2** — ambos modifican `useMessages.js` y el modelo de stats.

---

## Sprint 2 — Personaje y Economía
**Duración estimada:** 2 semanas  
**Experiencia objetivo:** *"He ganado 300 berries y mis stats han mejorado. Mi personaje está creciendo."*

### Tareas

#### Stats nuevos
- [x] Añadir `dexterity` y `charisma` a cada personaje en `src/data/characters.js` (valores equilibrados según el rol)
- [x] Migración Supabase: añadir `money`, `xp` y `stat_upgrades` a `session_character_state` (dex/cha son estáticos en characters.js; upgrades se almacenan en stat_upgrades JSONB)
- [x] Actualizar `buildCharacterContext()` en `prompts.js` para incluir los nuevos stats
- [x] Actualizar el modo Negotiation: usar `charisma` como stat base para conviction checks
- [x] Actualizar `MECHANICS_SYSTEM_PROMPT` para que el modelo mecánico sepa elegir dexterity/charisma

#### Economía básica
- [x] Campo `money` (berries) en `session_character_state` — inicial: 0
- [x] El modelo mecánico puede incluir `money_reward` en el JSON al vencer enemigos o encontrar tesoros
- [x] Mostrar berries en el panel de personaje (junto a los stats)
- [x] Recompensa por cabeza: campo `bounty` en personajes jugables (estático por ahora, crece en Sprint 7)
- [x] Enemigos con bounty — mostrado en `GameModePanel` al entrar en combate con ellos
- [x] Los personajes jugadores pueden tener su propio bounty visible en el panel

#### Progresión
- [x] Sistema de XP: ganar XP al vencer enemigos; guardar en `session_character_state`
- [x] Al acumular suficiente XP: opción de subir 1 punto en un stat elegido por el jugador (modal en GameRoom)
- [x] Boosts temporales por éxito crítico: +1 stat durante el evento actual (ya implementado en Sprint 1)

### Archivos afectados
`src/data/characters.js` · `src/lib/prompts.js` · `src/lib/narrator.js` · `src/hooks/useMessages.js` · `src/pages/GameRoom.jsx` · Supabase migrations

### Skills a leer
`/game-universe` · `/db-schema` · `/action-system`

### Paralelización
**⚡ PARALELIZABLE con Sprint 3 y 4**  
**🚫 NO paralelizar con Sprint 1** — ambos tocan `useMessages.js` y lógica de stats.

---

## Sprint 3 — UI/UX Épico
**Duración estimada:** 2 semanas  
**Experiencia objetivo:** *"Esto parece un juego de verdad. Quiero hacer una captura de pantalla para enseñárselo a alguien."*

### Tareas

#### 🔴 Prioritario: Panel de personaje — reorganización sin perder contenido
El panel acumula: stats base, stats nuevos (DES/CAR), habilidad especial, habilidad de fruta, equipamiento e inventario. Todo tiene su razón de estar, pero en móvil resulta incómodo. La solución no es eliminar nada sino reorganizar cómo se accede a ello.

- [x] **Sistema de pestañas dentro del panel lateral** — tres pestañas compactas:
  - `Personaje` → stats (HP, ATK, DEF, NAV, DES, CAR) + economía
  - `Poderes` → habilidad especial + habilidad de fruta del diablo + boosts activos
  - `Mochila` → equipamiento + inventario completo + berries
- [x] **En móvil: panel como bottom sheet deslizable** — botón flotante `⚔️`, sube con transición
- [x] **En desktop: panel lateral fijo** con las mismas pestañas siempre visible
- [x] Stats visuales compactos: barra de HP progress bar + valores numéricos con icono
- [x] La pestaña activa recuerda su estado entre renders

#### Resto de UI/UX
- [x] Animación de dado: CSS keyframes `dice-roll` al tirar (rotación 0.6s) + `scale-in` para el total
- [x] Visual de grado de éxito: texto dramático grande con DEGREE_LABELS (⚡ ¡CRÍTICO! / 💀 ¡CATÁSTROFE!)
- [x] Tipografía épica: fuente Cinzel para títulos (Grand Line, nombres de personaje, CharacterSelect)
- [x] Pantalla de inicio del lobby rediseñada: gradiente oscuro épico purple/blue, título con Cinzel + glow
- [x] Tarjetas de personaje en selección: barras de 5 stats (ATK/DEF/NAV/DES/CAR), hover impactante
- [x] Indicador de turno claro: nombre del jugador activo con `glow-pulse` animation en amber
- [x] Panel de modo de juego mejorado: bounty como badge prominente, enemigo derrotado con grayscale, HP transition 700ms
- [x] Transiciones entre modos (combat → normal) con efecto flash de color
- [x] Typing indicator del narrador: 3 puntos con `dot-bounce` escalonado

### Archivos afectados
`src/components/*.jsx` · `src/pages/Lobby.jsx` · `src/pages/CharacterSelect.jsx` · `src/data/constants.js` · CSS/Tailwind

### Skills a leer
`/frontend-design` · `/canvas-design` · `/game-universe`

### Paralelización
**⚡ PARALELIZABLE con Sprint 1, 2 y 4** — toca solo UI/presentación.

---

## Sprint 4 — Contenido y Gestión de Historias ✅ COMPLETADO
**Duración estimada:** 2 semanas  
**Experiencia objetivo:** *"¿Podemos crear nuestra propia historia hoy? Quiero inventarme una isla."*

### Tareas

#### Historias en BD + editor desde UI
- [x] Migrar historias de archivos `.md` a tabla `stories` en Supabase (title, description, lore, is_custom)
- [x] Formulario en Lobby para **crear y editar historias** desde la interfaz: título, descripción, lore, duración (`StoryEditor.jsx`)
- [x] El Director carga historias desde BD en lugar de archivos locales (`loadStory()` en `director.js`)
- [x] Pantalla de selección de historia mejorada: secciones "Tus historias" / "Oficiales", badges, edición/borrado inline

#### Continuar partidas terminadas
- [x] Al terminar una historia, ofrecer "Nueva aventura con esta tripulación" (modal en `GameRoom.jsx`)
- [x] Mantener personajes con sus stats, inventario, XP y berries ganados (`continueWithCrew` en `App.jsx` + `Lobby.jsx`)
- [x] El Director genera una nueva historia apropiada (el selector de historia ya existe; banner informativo en story-picker)
- [x] Sesión nueva crea character states copiando progresión de la sesión terminada (HP reset a máximo)

#### Más contenido
- [x] 4 historias nuevas: Fortaleza Korrath (heist), Arrecife Perdido (exploración submarina), Festival de Baltimor (conspiración), Sombras en la Marina (thriller político)
- [x] Sistema de eventos aleatorios en navegación: `rollNavigationEvent()` en `director.js` · trigger ~12% por tirada en `useMessages.js`
- [ ] Modo boss: enemigo único con fases, texto especial, recompensa única garantizada _(diferido a Sprint 5/6)_
- [ ] Más items únicos y raros en la tabla `items` de Supabase _(diferido a Sprint 5/6)_

### Archivos afectados
`src/data/stories/*.md` → Supabase · `src/lib/director.js` · `src/pages/Lobby.jsx` · `src/hooks/useSession.js`

### Skills a leer
`/lore-one-piece` · `/game-flow` · `/db-schema`

### Paralelización
**⚡ PARALELIZABLE con Sprint 1, 2 y 3** — archivos casi completamente distintos.

---

## Sprint 5 — Mundo Persistente: Marina y Mapa
**Duración estimada:** 3 semanas  
**Experiencia objetivo:** *"¡El almirante Korrath que conocimos en la primera historia apareció de nuevo! Y sigue recordando que le ganamos."*

**Depende de:** Sprint 4 (historias en BD)

### Por qué es importante
Da coherencia al mundo entre sesiones. El universo empieza a sentirse vivo y con memoria.

### Tareas

#### Sistema de Marina (NPCs persistentes)
- [ ] Tabla `world_npcs` en Supabase: `id, name, rank, faction, hp, attack, defense, description, status, first_seen_session`
- [ ] Jerarquía de marina: Almirante de Flota → 3 Almirantes → Vicealmirantes → Capitanes (generada por IA en primera sesión)
- [ ] Cuando el narrador genera un NPC de marina, el modelo mecánico lo guarda en `world_npcs` con sus características
- [ ] En historias siguientes, la IA consulta `world_npcs` para mantener coherencia (mismo nombre, stats, actitud)
- [ ] Si un NPC es derrotado en combate → `status: 'defeated'` → no vuelve a aparecer activo
- [ ] Panel de "Enemigos conocidos" en Lobby: lista de NPCs descubiertos con su info

#### Sistema de Mapa
- [ ] Tabla `world_locations` en Supabase: `id, name, description, discovered_in_session, connections[]`
- [ ] Grafo de ubicaciones: cada isla/lugar es un nodo, las rutas son aristas con distancia (días de viaje)
- [ ] Al explorar una ubicación nueva, el modelo la guarda en `world_locations` y conecta con la anterior
- [ ] Vista de mapa en Lobby: representación visual del grafo de islas descubiertas (SVG o canvas)
- [ ] Al iniciar nueva historia, el Director sugiere destinos coherentes con el grafo existente

### Archivos afectados
Nuevas tablas Supabase · `src/lib/director.js` · `src/lib/narrator.js` · `src/pages/Lobby.jsx` · nuevos componentes

### Skills a leer
`/db-schema` · `/narrator` · `/lore-one-piece` · `/game-flow`

### Paralelización
**🚫 NO paralelizar con Sprint 6** — ambos añaden features complejas que tocan Lobby y BD.

---

## Sprint 6 — Social y Engagement
**Duración estimada:** 2 semanas  
**Experiencia objetivo:** *"Oye, ¿te puedo pasar el link para que te unas? Estamos jugando ahora."*

**Depende de:** Sprint 1 (mecánicas) + Sprint 3 (UI)

### Tareas
- [ ] Link de invitación: URL con `session_id` que lleva directamente a selección de personaje
- [ ] Reacciones de emoji en mensajes del narrador (todos pueden reaccionar, visible en tiempo real)
- [ ] Espectadores mejorados: pueden votar sobre la acción del jugador en turno
- [ ] Recap de sesión al terminar: highlights automáticos (mejores tiradas, momentos épicos, muertes)
- [ ] Notificaciones in-game: "es tu turno" badge en pestaña del navegador
- [ ] Panel de historial de sesiones: ver resúmenes de partidas pasadas en Lobby
- [ ] Modo "Fácil para familia": simplificar UI, reducir complejidad de opciones visibles

### Archivos afectados
`src/hooks/usePresence.js` · `src/pages/GameRoom.jsx` · `src/pages/Lobby.jsx` · nuevos componentes

### Skills a leer
`/game-flow` · `/db-schema` · `/frontend-design`

---

## Sprint 7 — Progresión entre Sesiones
**Duración estimada:** 2 semanas  
**Experiencia objetivo:** *"Mi personaje ya tiene nivel 4. Los berries que tengo de la última sesión me permiten comprar esa espada que vi."*

**Depende de:** Sprint 2 (XP/economía) + Sprint 5 (mundo persistente)

### Tareas
- [ ] Progresión de personaje persiste entre sesiones: nivel, XP, stats mejorados, berries acumulados
- [ ] Sistema de suministros: campo `supplies_days` en sesión — se gasta en viajes largos según distancia en el mapa
- [ ] Economía avanzada: comprar suministros e items en puertos (tienda en Lobby o durante historia)
- [ ] Sistema de reputación de tripulación: los jugadores ganan puntos de crew en conjunto
- [ ] Bounties de personajes jugadores crecen con victorias notables — visibles en un "cartel de se busca"
- [ ] Hall of fame: lista de las mejores partidas (récords, momentos épicos, muertes heroicas)
- [ ] Títulos de personaje: "Espadachín del Norte", "Navegante Legendario" — visibles en el chat

### Archivos afectados
Nuevas tablas Supabase · `src/hooks/useSession.js` · `src/hooks/useMessages.js` · nuevos componentes

### Skills a leer
`/db-schema` · `/game-universe` · `/game-flow`

---

## Sprint 8 — PWA y Lanzamiento
**Duración estimada:** 1 semana  
**Experiencia objetivo:** *"Lo tengo instalado en el móvil. Puedo jugarlo sin abrir el navegador."*

**Depende de:** todos los sprints anteriores

### Tareas
- [ ] Service worker: cache de assets, funcionalidad offline básica
- [ ] Manifest PWA: icono, nombre, splash screen
- [ ] Push notifications: "es tu turno" cuando la pestaña está en segundo plano
- [ ] Landing page: descripción del juego, captura, CTA para entrar
- [ ] Audit de rendimiento: lighthouse score > 85
- [ ] Variables de entorno en Vercel verificadas
- [ ] README actualizado con instrucciones de despliegue

### Skills a leer
`/frontend-design`

---

## Backlog — Propuestas a explorar (post-lanzamiento)

Ideas del equipo que aún no tienen sprint asignado. Se revisarán cuando el juego esté lanzado y haya feedback real de jugadores.

| Idea | Descripción | Complejidad |
|---|---|---|
| **Historias infinitas autogeneradas** | La IA genera islas, rutas y personajes a tiempo real sin historias predefinidas | Alta |
| **Generación de imágenes** | Imágenes de personajes, islas y momentos épicos generadas por IA | Alta |
| **Login con usuarios** | Autenticación real para persistir personajes entre dispositivos | Media |
| **Limitador de habilidades especiales** | Usos por combate/sesión para evitar spam — activar una vez funcionen todas | Baja |
| **Historias colaborativas desde UI** | Varios jugadores co-crean la historia antes de empezar | Media |

---

## Guía para agentes que ejecutan sprints

Antes de empezar cualquier sprint, un agente debe:

1. **Leer** los skills indicados en la sección "Skills a leer" del sprint
2. **Confirmar** que no hay otro agente trabajando en los mismos archivos (consultar sección Paralelización)
3. **Crear** un plan detallado de las tareas antes de tocar código
4. **Ejecutar** las tareas en orden, marcando cada una como completada
5. **Actualizar** CLAUDE.md y el skill relevante si se añade funcionalidad nueva
6. **Ejecutar** `/simplify` al terminar para revisar calidad
7. **Ejecutar** `/commit` para generar el commit con mensaje formateado

### Matriz de paralelización rápida

| | B1-2 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 |
|---|---|---|---|---|---|---|---|---|---|
| **Bugs** | — | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **S1** | ✅ | — | 🚫 | ✅ | ✅ | — | — | — | — |
| **S2** | ✅ | 🚫 | — | ✅ | ✅ | — | — | — | — |
| **S3** | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — |
| **S4** | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — |
| **S5** | — | — | — | — | — | — | 🚫 | — | — |
| **S6** | — | — | — | — | — | 🚫 | — | — | — |

✅ Pueden ejecutarse en paralelo · 🚫 No paralelizar · — No aplica (dependencia secuencial)
