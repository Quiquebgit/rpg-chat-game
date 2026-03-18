# Narrador IA — configuración y formato

## Modelo
Groq API, modelo `llama-3.3-70b-versatile`. Cliente en `src/lib/groq.js`.
System prompt completo en `src/lib/narrator.js` → constante `NARRATOR_SYSTEM_PROMPT`.

## Qué recibe el narrador en cada llamada
- System prompt (universo, reglas, formato)
- Estado de todos los personajes (hp, inventario, habilidades, stats)
- Historial reciente (últimos 20 mensajes)
- Mensaje del jugador en turno

## Formato de respuesta (JSON obligatorio)
```json
{
  "is_action": true,
  "narrative": "Texto visible en el chat.",
  "next_character_id": "shin",
  "dice_required": false,
  "dice_count": 1,
  "stat_updates": [
    { "character_id": "darro", "hp_delta": -2 }
  ]
}
```
- `is_action`: `true` si es acción concreta; `false` si es pregunta o conversación
- `narrative`: solo se muestra si `is_action: true`
- `next_character_id`: id del siguiente personaje (válidos: `darro`, `shin`, `vela`, `crann`, `lissa`, `brek`)
- `dice_required`: `true` si el narrador pide tirada de dados antes de continuar
- `dice_count`: `1` o `2` dados d6 (solo relevante si `dice_required: true`)
- `stat_updates`: array de deltas de vida a aplicar en `session_character_state`; puede ser vacío o ausente

Si el modelo no devuelve JSON válido, se usa la respuesta en bruto como narrativa (`is_action` se asume `true`).

## Apertura automática
En sesiones nuevas, se llama a Groq con `forceAction: true` para que el narrador presente la escena sin esperar mensaje de jugador.

## Comportamiento narrativo
- Responde en el idioma de los jugadores
- Tono dramático y cinematográfico
- No juega por los personajes, solo narra consecuencias
- Aplica reglas de stats con coherencia
