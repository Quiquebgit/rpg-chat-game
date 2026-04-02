---
name: game-universe
description: Referencia del universo del juego, stats y personajes. Leer antes de tocar characters.js, el system prompt o mecánicas de juego.
---

# Universo del juego, stats y personajes

## Universo
Inspirado en One Piece, personajes y lugares 100% originales.
- Piratas, marinos, islas, el Gran Line
- **Frutas del diablo:** poderes únicos + el portador no puede nadar. Nadie empieza con una. El grupo decide cooperativamente quién se la come cuando aparece una.
- **Haki:** energía espiritual que muy pocos desarrollan
- El mar mata: tormentas, criaturas, corrientes imposibles

## Sistema de stats
Números bajos, al estilo del juego de mesa del Señor de los Anillos. Cada punto importa.

| Stat | Clave | Descripción |
|---|---|---|
| **Vida** | `hp` | Puntos que pierdes al recibir daño |
| **Ataque** | `attack` | Daño que haces en combate con armas o golpes |
| **Defensa** | `defense` | Reduce el daño recibido (ataque − defensa = vida perdida, mínimo 0) |
| **Navegación** | `navigation` | Manejo del barco, orientación, sortear peligros marítimos |
| **Destreza** | `dexterity` | Agilidad personal, sigilo, precisión, acrobacias, engañar con el cuerpo |
| **Carisma** | `charisma` | Persuasión, intimidación, liderazgo social, detección de mentiras |

Cada personaje tiene una **habilidad especial única** (no numérica).

### Cuándo usar Destreza vs Ataque
- **Ataque** → dañar en combate
- **Destreza** → moverse de forma hábil, sigilo, tirada de apoyo acrobática antes de atacar, escapar, pickpocket

### Cuándo usar Carisma vs otras acciones
- **Carisma** → convencer, intimidar, engañar verbalmente, leer intenciones de un NPC
- En modo Negotiation, Carisma es el stat principal para avanzar conviction
- En modo Exploration, Carisma sirve para obtener información de NPCs locales

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
| Combate — atacar | Ataque |
| Combate — resistir/aguantar | Defensa |
| Huir / Perseguir / Tormenta | Navegación total del barco |
| Acrobacia, sigilo, precisión | Destreza |
| Convencer, intimidar, engañar | Carisma |
| Negociación (conviction) | Carisma |
| Habilidad especial del personaje | Según el personaje |
| Acción arriesgada genérica | El narrador / modelo mecánico decide |

## Inventario
Estructura JSONB en `session_character_state.inventory`:
```json
{
  "name": "...", "type": "fruta|arma|equipo|consumible", "rarity": "común|raro|único",
  "effects": [{ "stat": "attack|defense|navigation|hp", "modifier": 2 }],
  "equippable": true, "equipped": false,
  "is_fruit": true,
  "immune_to": ["physical", "slash"],
  "special_effect": { "type": "aoe_attack|blind|..." },
  "special_ability": "descripción texto libre"
}
```
- `equippable && equipped` → bonus de stat activo
- `is_fruit` → fruta del diablo activa (comida, efecto permanente)
- `immune_to[]` → tipos de ataque que el portador ignora. Haki (`haki`) perfora siempre cualquier inmunidad.

## Personajes
Definidos en `src/data/characters.js`. 6 personajes fijos en el MVP.
Campos: `id, name, role, combatStyle, hp, attack, defense, navigation, dexterity, charisma, ability`.

Estructura de `ability`:
```js
{
  name: 'Nombre',
  description: 'Descripción narrativa',
  type: 'stat_boost | ranged_attack | heal | double_attack_first | navigation_bonus | team_heal',
  effect: { /* campos según type */ }
}
```

Ejemplos de `ability.effect` por tipo:
- `stat_boost`: `{ stat: 'attack', value: 2, target: 'ally', uses_per_combat: 1 }`
- `ranged_attack`: `{ ignore_defense: 1, target: 'enemy' }`
- `heal`: `{ value_combat: 2, value_out_combat: 4, target: 'any' }`
- `double_attack_first`: `{ multiplier: 2, trigger: 'first_attack_per_combat' }`
- `navigation_bonus`: `{ value: 3, uses_per_session: 1 }`
- `team_heal`: `{ value: 1, target: 'all', when: 'out_combat' }`

**IMPORTANTE:** El valor del bonus está en `ability.effect.value`, no en `ability.value`.
Acceso seguro: `ability?.effect?.value ?? ability?.value ?? 0`.
