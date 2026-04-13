# Test Results - Grand Line RPG

**Fecha:** 2026-04-13
**Tester:** Claude (Playwright MCP)
**Entorno:** localhost:5177, dev server Vite 8, navegador Chromium

---

## Prueba 1: Flujo completo — Nueva aventura hasta combate
**Estado:** Completada

### Hallazgos

- **Landing page:** Funcional, CTA "Comenzar aventura" redirige al Lobby correctamente
- **Lobby:** Carga historias desde Supabase, botón "+ Nueva aventura" funciona
- **Selección de historia:** Modal con historias disponibles, selección de dificultad operativa
- **CharacterSelect:** 6 personajes con barras de stats, botón "Zarpar" funciona
- **GameRoom:** Carga correctamente con panel de personaje, chat e input
- **Narrador IA:** Responde a mensajes del jugador con narración coherente (llama-4-scout)
- **Combate:** Se activa correctamente, panel de enemigos muestra HP/ATK/DEF, habilidades especiales
- **Tiradas de dados:** DiceMessage animado funciona con grado visual
- **Iniciativa:** Botón "Tirar iniciativa" aparece en combate y funciona

### Bugs encontrados
Ninguno crítico en este flujo.

---

## Prueba 2: Navegación y exploración
**Estado:** Completada

### Hallazgos

- **Navegación:** El narrador activa modo navegación cuando el jugador zarpa
- **Tiradas de navegación:** Funcionan con stat NAV del personaje
- **Suministros:** Visibles en panel (27 días restantes en la sesión de prueba)
- **Transiciones:** El narrador narra fluidamente las transiciones entre modos
- **Eventos de navegación:** El Director genera eventos narrativos durante la navegación

### Bugs encontrados
Ninguno crítico en este flujo.

---

## Prueba 3: Negociación y sistemas sociales
**Estado:** Completada

### Hallazgos

- **Comando OOC (`//`):** Probado y ARREGLADO (ver Bug #1 abajo)
- **Comando acción (`/`):** Funciona — envía como tipo `action`
- **Mensajes del jugador:** Los mensajes de tipo `player` no se renderizan visiblemente en el chat (ver Bug #2)
- **Reacciones emoji:** Botón "+" visible en mensajes del narrador
- **Mensaje OOC renderizado:** Se muestra con formato especial (✦ nombre texto ✦)

### Bugs encontrados
- **Bug #1 (ALTA - ARREGLADO):** `//` tratado como acción `/` — ver sección Bugs
- **Bug #2 (MEDIA):** Mensajes del jugador no visibles en el chat — ver sección Bugs

---

## Prueba 4: Panels y UI
**Estado:** Completada

### Hallazgos

- **CharacterPanel tabs:** Personaje/Poderes/Mochila funcionan correctamente
  - Tab Personaje: stats, HP, bounty, XP visibles
  - Tab Poderes: descripción de habilidad del personaje
  - Tab Mochila: items con botón Equipar funcional
- **Bitácora:** Abre correctamente con 4 tabs
  - Enemigos: estado vacío informativo cuando no hay enemigos conocidos
  - Mapa: estado vacío informativo ("El mapa está en blanco")
  - Tripulación: WantedPosterCard con bounty y reputación (0 pts — Novatos)
  - Tienda: Lista de items con precios, suministros del barco, botón Comprar
- **Toggle tema:** Dark "Grand Line Night" ↔ Light "Dawn Island" funciona sin errores
- **Modo familia:** Simplifica UI correctamente (stats como puntos, panel sin tabs, combate simplificado)
- **Botón debug:** Visible en producción (ver Bug #3)

### Bugs encontrados
- **Bug #3 (BAJA):** Botón debug visible — ver sección Bugs

---

## Prueba 5: Lobby — Gestión de sesiones
**Estado:** Completada

### Hallazgos

- **Tab Activas:** 19 sesiones con botones Invitar/Entrar/Archivar/Borrar
- **Tab Terminadas:** 8 sesiones terminadas con mismo layout que activas
- **Tab Archivadas:** 1 sesión archivada con botones restaurar/borrar
- **Tab Salón de la Fama:** 7 entradas con WantedPosterCard, duración, mensajes, personaje
- **Sesiones antiguas sin título:** Algunas sesiones creadas antes del Sprint 4 no muestran nombre de historia (solo "Activa")
- **Navegación entre tabs:** Fluida, contadores precisos

### Bugs encontrados
- **Bug #4 (BAJA):** Sesiones antiguas sin nombre de historia — ver sección Bugs

---

## Bugs Encontrados

### Bug #1: Comando OOC `//` tratado como acción `/`
- **Severidad:** ALTA
- **Estado:** ✅ ARREGLADO
- **Ubicación:** `src/pages/GameRoom.jsx` línea ~233, `src/hooks/useMessages.js` línea ~1170
- **Descripción:** Al escribir `//texto`, el handler `handleSend()` entraba en la condición `text.startsWith('/')` antes de comprobar `//`. Esto enviaba el mensaje como acción, activando al narrador innecesariamente y corrompiendo el estado del juego.
- **Fix aplicado:**
  1. Se añadió comprobación `text.startsWith('//')` ANTES de `text.startsWith('/')` en `handleSend()`
  2. Se modificó `sendChat()` para aceptar parámetro opcional `msgType` (default `'player'`)
  3. Los mensajes OOC ahora se envían como tipo `'ooc'` y no activan al narrador

### Bug #2: Mensajes del jugador no visibles en el chat
- **Severidad:** MEDIA
- **Estado:** ⏳ PENDIENTE
- **Ubicación:** `src/pages/GameRoom.jsx` o `src/hooks/useMessages.js` (renderizado de mensajes)
- **Descripción:** Los mensajes enviados por el jugador (tipo `player`) se insertan en la BD correctamente (el narrador responde a ellos), pero no aparecen visualmente en el chat. Solo se ven mensajes del narrador, tiradas y OOC. Esto hace que la conversación parezca unilateral.
- **Impacto:** El jugador no ve lo que escribió, lo cual es confuso aunque el juego funciona.

### Bug #3: Botón debug visible en producción
- **Severidad:** BAJA
- **Estado:** ⏳ PENDIENTE
- **Ubicación:** `src/pages/GameRoom.jsx` (CharacterPanel / Mochila)
- **Descripción:** El botón `+ debug: añadir item` aparece visible en el panel de Mochila. Debería estar oculto o eliminado en producción. También aparece en modo familia.
- **Impacto:** Confusión para el usuario; posibilidad de añadir items sin coste.

### Bug #4: Sesiones antiguas sin nombre de historia
- **Severidad:** BAJA
- **Estado:** ⏳ PENDIENTE (cosmético)
- **Ubicación:** `src/pages/Lobby.jsx`
- **Descripción:** Las sesiones creadas antes de Sprint 4 (cuando se añadió `story_title` a la tabla sessions) no muestran el nombre de la historia en el Lobby. Solo muestran "Activa" sin título.
- **Impacto:** Puramente cosmético. El usuario no puede distinguir entre sesiones antiguas.

---

## Errores de consola observados (no bugs del juego)

- **Google TTS 403:** `API_KEY_HTTP_REFERRER_BLOCKED` — La API key de Google TTS bloquea peticiones desde localhost. Esperado en desarrollo; el fallback a Web Speech API funciona. En producción con el dominio correcto configurado no debería ocurrir.
- **Modelo mecánico 400:** `tool_use_failed` y `json_validate_failed` — Errores intermitentes del modelo Groq al generar enemigos. El sistema usa defaults cuando falla, así que no es crítico pero puede generar enemigos genéricos.

---

## Resumen

| Severidad | Encontrados | Arreglados | Pendientes |
|-----------|-------------|------------|------------|
| Alta      | 1           | 1          | 0          |
| Media     | 1           | 0          | 1          |
| Baja      | 2           | 0          | 2          |

### Valoración general

El juego es **funcional y jugable**. Los flujos principales (crear sesión, elegir personaje, jugar, combatir, navegar) funcionan correctamente. El bug crítico del OOC ya fue arreglado. El bug de mensajes del jugador no visibles es el más importante pendiente — no rompe el juego pero genera confusión. Los bugs de severidad baja son cosméticos.

**Áreas que funcionan bien:**
- Narrador IA coherente y responsive
- Sistema de combate determinista
- Bitácora con 4 tabs informativos
- Toggle de tema (dark/light) sin errores
- Modo familia simplifica UI correctamente
- Lobby con gestión completa de sesiones
- Tienda con items y precios

**Recomendación de prioridad para fixes:**
1. Bug #2 — Mensajes del jugador no visibles (impacto en UX)
2. Bug #3 — Botón debug visible (fácil de arreglar)
3. Bug #4 — Sesiones sin título (cosmético)
