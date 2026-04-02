---
name: action-system
description: Sistema de tiradas de dados y resolución de acciones. Leer antes de tocar DiceMessage, useMessages, la lógica de skill checks, grados de éxito/fallo o tiradas de apoyo.
---

# Sistema de tiradas y resolución de acciones

## Filosofía
El sistema sigue una mecánica de **dados + stat vs dificultad (DC)**, inspirada en el C-System de rol de mesa.
Cada acción significativa del jugador se resuelve con una tirada. El modelo mecánico determina qué stat usar y la DC.
El resultado nunca lo decide libremente la IA — el código valida el éxito y calcula los efectos.

---

## Flujo de resolución de una acción

```
Jugador describe acción
        ↓
Modelo mecánico → { skill_check: { stat, dc, description } }
        ↓
UI solicita tirada al jugador (DiceMessage con botón dado)
        ↓
Jugador tira → resultado: dado + stat_value
        ↓
Código calcula grado: checkDegree(roll + stat, dc)
        ↓
{ degree: 'critical_success' | 'success' | 'failure' | 'critical_failure' }
        ↓
Narrador recibe resultado + grado (nunca el JSON crudo)
        ↓
Narrador narra consecuencias acordes al grado
```

---

## Stats usados en tiradas

| Stat | Clave | Cuándo usarlo en un skill check |
|---|---|---|
| Ataque | `attack` | Golpear, forzar algo físicamente, levantar peso |
| Defensa | `defense` | Resistir, aguantar dolor, bloquear un efecto |
| Navegación | `navigation` | Maniobrar el barco, orientarse, sortear peligros marítimos |
| Destreza | `dexterity` | Sigilo, acrobacias, precisión, escabullirse, pickpocket, tirada de apoyo ágil |
| Carisma | `charisma` | Convencer, intimidar, mentir/detectar mentiras, avanzar conviction en negociación |

El modelo mecánico elige el stat apropiado según la descripción de la acción. Si hay dudas, el stat más narrativamente coherente con la intención del jugador.

---

## Dificultades (DC) orientativas

| Dificultad | DC | Ejemplo |
|---|---|---|
| Trivial | — | Automáticamente exitoso si el stat es suficiente |
| Fácil | 6 | Mover un cajón, saltar un charco |
| Normal | 9 | Escalar una pared con agarre, convencer a alguien neutral |
| Difícil | 12 | Romper una puerta reforzada, acción en condiciones adversas |
| Muy difícil | 15 | Hazaña notable, superar a un experto |
| Extremo | 18 | Proeza heroica, solo los mejores lo consiguen |
| Imposible | 21+ | Requiere fruta del diablo o circunstancias extraordinarias |

El modelo mecánico es quien fija la DC basándose en el contexto narrativo.

---

## Grados de éxito/fallo

```
resultado = dado (1–6) + valor_del_stat
```

| Resultado vs DC | Grado | Efectos |
|---|---|---|
| resultado ≥ DC + 6 | **Éxito crítico** | Logro excepcional + bonus extra (XP, efecto especial, encontrar algo único) |
| resultado ≥ DC + 3 | **Éxito bonus** | Éxito + ventaja adicional (stat temporal, información extra, acción gratis) |
| resultado ≥ DC | **Éxito** | La acción funciona tal como se intentó |
| resultado < DC | **Fallo** | La acción no funciona; consecuencias menores |
| resultado ≤ DC − 3 | **Fallo crítico** | Consecuencia grave (daño al personaje, información falsa, situación peor) |

**El narrador siempre recibe el grado, nunca los números crudos.** Narra el grado de forma dramática.

---

## Tiradas de apoyo

Una tirada de apoyo es una acción creativa previa que da un bonus a la tirada principal.

```
Jugador declara acción de apoyo creativa
        ↓
Modelo mecánico → { support_roll: { stat, dc: DC_apoyo } }
        ↓
Jugador tira apoyo → si supera DC_apoyo: bonus = +3 a la tirada principal
        ↓
Tirada principal: dado + stat + (bonus_apoyo si aplica) vs DC_principal
```

**Ejemplo:** "Me cuelgo de la lámpara para atacar desde arriba" → tirada de apoyo (navigation, DC 9) → si éxito → +3 al ataque principal.

Solo se permite **una tirada de apoyo por acción principal**. El modelo decide si la intención del jugador justifica un apoyo o es directamente la acción.

---

## Desafíos sostenidos (multi-tirada)

Para acciones largas (huida, escalada prolongada, negociación extensa):

```json
{
  "sustained_challenge": {
    "description": "Huir por los tejados del mercado",
    "stat": "navigation",
    "dc_per_roll": 9,
    "rolls_required": 4,
    "total_threshold": 30,
    "max_rolls": 6
  }
}
```

- El jugador tira múltiples veces, acumulando resultados
- Si alcanza `total_threshold` dentro de `max_rolls` → éxito global
- El narrador comenta cada tirada parcialmente
- Si agota `max_rolls` sin alcanzar el umbral → fallo con consecuencias proporcionales a lo conseguido

---

## Implementación en el código

### JSON del modelo mecánico (fuera de combate)
El modelo mecánico debe devolver un campo `skill_check` cuando la acción lo requiere:

```json
{
  "intent": "skill_check",
  "skill_check": {
    "stat": "attack",
    "dc": 9,
    "description": "Intentas mover la roca que bloquea el camino"
  },
  "narrate": false
}
```

Cuando `narrate: false`, el sistema espera la tirada antes de llamar al narrador.

### Resultado que recibe el narrador
```json
{
  "skill_check_result": {
    "stat": "attack",
    "roll": 4,
    "stat_value": 3,
    "total": 7,
    "dc": 9,
    "degree": "failure",
    "support_bonus": 0
  }
}
```

### Archivos a tocar
| Archivo | Qué modificar |
|---|---|
| `src/lib/narrator.js` | Añadir `skill_check` al prompt del modelo mecánico |
| `src/lib/prompts.js` | Incluir resultado de tirada en contexto para el narrador |
| `src/hooks/useMessages.js` | Gestionar estado `pending_skill_check`, llamar al narrador tras tirada |
| `src/components/DiceMessage.jsx` | Mostrar grado de éxito visualmente |
| `src/lib/combat.js` | `checkDegree(total, dc)` — función pura reutilizable |

### Función checkDegree (añadir en combat.js)
```js
// Calcula el grado de éxito de una tirada vs una dificultad
export function checkDegree(total, dc) {
  const diff = total - dc;
  if (diff >= 6) return 'critical_success';
  if (diff >= 3) return 'bonus_success';
  if (diff >= 0) return 'success';
  if (diff >= -3) return 'failure';
  return 'critical_failure';
}
```

---

## Estado actual de dados en el código

| Funcionalidad | Estado | Archivo |
|---|---|---|
| `rollDice(count)` — tirada libre | ✅ | useMessages.js |
| `rollInitiative()` — 1d6 + ataque, inicio combate | ✅ | useMessages.js |
| `rollNavigation()` — suma nav equipo vs umbral | ✅ | useMessages.js |
| Skill checks genéricos (acción + stat + DC) | ❌ Pendiente Sprint 1 | — |
| Grados de éxito/fallo | ❌ Pendiente Sprint 1 | — |
| Tiradas de apoyo | ❌ Pendiente Sprint 1 | — |
| Desafíos sostenidos | ❌ Pendiente Sprint 1 | — |

---

## Reglas de oro
1. El total (dado + stat) lo calcula el código, nunca el modelo
2. El modelo mecánico pide la tirada, el código la ejecuta
3. El narrador recibe el grado en texto, nunca los números
4. Un fallo debe tener consecuencias narrativas interesantes, no solo "no pasa nada"
5. Los éxitos críticos deben sentirse épicos y recompensar la creatividad del jugador
