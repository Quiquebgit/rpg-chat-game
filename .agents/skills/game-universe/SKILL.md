# Universo del juego, stats y personajes

## Universo
Inspirado en One Piece, personajes y lugares 100% originales.
- Piratas, marinos, islas, el Gran Line
- **Frutas del diablo:** poderes únicos + el portador no puede nadar. Nadie empieza con una. El grupo decide cooperativamente quién se la come cuando aparece una.
- **Haki:** energía espiritual que muy pocos desarrollan
- El mar mata: tormentas, criaturas, corrientes imposibles

## Sistema de stats
Números bajos, al estilo del juego de mesa del Señor de los Anillos. Cada punto importa.

| Stat | Descripción |
|---|---|
| **Vida** | Puntos que pierdes al recibir daño |
| **Ataque** | Daño que haces en combate |
| **Defensa** | Reduce el daño recibido (ataque − defensa = vida perdida, mínimo 1) |
| **Navegación** | Baja navegación + ruta peligrosa = penalización o encuentro no deseado |

Cada personaje tiene una **habilidad especial única** (no numérica).

## Dados
Se usan dados de 6 caras (d6). El narrador decide cuántos según la dificultad:
- **1d6** — situación moderada
- **2d6** — situación difícil o extrema

El narrador solicita la tirada en su JSON con `"dice_required": true` y `"dice_count": 1` o `2`.
El jugador en turno pulsa el botón de dados; el resultado es visible para todos en el chat.

## Mecánica de Navegación
Usada para huir, perseguir, sortear tormentas, evitar monstruos y eventos marinos.

**Navegación del barco** = suma de navegación de todos los jugadores activos.

**Tirada:** dados + navegación total del barco vs umbral X definido por el narrador.

| Dificultad | Umbral orientativo |
|---|---|
| Fácil | 8 |
| Normal | 12 |
| Difícil | 16 |
| Extremo | 20 |

**Resultados:**
- **Supera el umbral** → éxito completo
- **Llega justo** → éxito parcial con algún coste
- **No llega** → fallo, el narrador narra las consecuencias

**Modificadores positivos:** habilidades especiales, items del inventario, gastar recursos, sacrificar vida.
**Modificadores negativos:** tormenta activa (-1 o -2), barco dañado, jugadores desconectados.

## Mecánica de Combate
- **Daño recibido** = ataque enemigo − defensa del personaje (mínimo 1)
- Si defensa >= ataque enemigo, no se recibe daño
- La vida baja en `session_character_state` automáticamente vía `stat_updates` en el JSON del narrador

## Cuándo se usan los dados
| Situación | Stat relevante |
|---|---|
| Combate | Ataque / Defensa |
| Huir / Perseguir | Navegación total del barco |
| Tormenta / Monstruo marino | Navegación total del barco |
| Habilidad especial | Según el personaje |
| Acción arriesgada | El narrador decide |

## Inventario
Estructura JSONB: `{ "name": "...", "type": "fruta|arma|objeto", "effect": "..." }`

## Personajes
Definidos en `src/data/characters.js`. 6 personajes fijos en el MVP.
Campos: `id, name, role, combatStyle, hp, attack, defense, navigation, ability { name, description }`.
