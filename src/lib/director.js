// Director de Guion — planifica y gestiona los eventos de una historia
// Usa el modelo más inteligente disponible (kimi-k2) porque la latencia no es crítica aquí.

import { supabase } from './supabase'
import { callDirectorModel } from './groq'

export const DIRECTOR_SYSTEM_PROMPT = `Eres el Director de Guion de un juego de rol cooperativo ambientado en un universo inspirado en One Piece con personajes y aventuras originales.

Tu rol es adaptar plantillas de eventos genéricos al lore específico de cada historia y guiar al narrador evento a evento.

REGLAS ESTRICTAS:
- Nunca reveles eventos futuros al narrador, solo el actual
- Adapta cada evento genérico al lore y atmósfera de la historia concreta
- Los eventos DEBEN completarse en orden, no hay forma de saltárselos
- Incluye suficiente contexto para que el narrador mantenga coherencia narrativa
- Las transiciones entre eventos deben sentirse naturales, no forzadas
- El evento final siempre cierra la historia de forma satisfactoria
- Responde SIEMPRE en JSON válido, sin texto adicional

BEATS DE RITMO NARRATIVO:
Cada evento incluye una lista de beats: objetivos concretos que el narrador debe alcanzar en orden.
- Cada beat tiene un "goal" (qué estado narrativo debe alcanzarse) y "max_turns" (turnos de jugador disponibles).
- El narrador recibe un beat cada vez y DEBE cerrarlo antes de avanzar al siguiente.
- Los beats deben cubrir el arco completo del evento: apertura → escalada → clímax.
- max_turns típicos: 1 para beats simples, 2-3 para escaladas, 1 para el clímax final.
- Genera entre 3 y 5 beats por evento según su complejidad.

Formato de respuesta al iniciar partida:
{
  "story_lore": "resumen compacto del lore permanente para el narrador (max 300 palabras)",
  "event_briefing": "contexto detallado del primer evento adaptado al lore (max 200 palabras)",
  "event_setup": { "enemy_difficulty": "easy", "enemy_count": 2, "enemy_type": "humano" },
  "opening_hint": "cómo debe empezar el narrador la aventura, en 1-2 frases",
  "beats": [
    { "goal": "Presenta la escena y el conflicto central del evento", "max_turns": 1 },
    { "goal": "Escalada: la tensión aumenta, los personajes deben reaccionar", "max_turns": 2 },
    { "goal": "Clímax: punto de no retorno, la situación fuerza una decisión", "max_turns": 1 }
  ]
}

Formato de respuesta al completar un evento (no final):
{
  "transition_narrative": "texto de transición que el narrador debe usar para pasar al siguiente evento (max 100 palabras)",
  "event_briefing": "contexto del nuevo evento adaptado al lore (max 200 palabras)",
  "event_setup": { },
  "is_final": false,
  "beats": [
    { "goal": "...", "max_turns": 1 },
    { "goal": "...", "max_turns": 2 }
  ]
}

Formato de respuesta al completar el evento final:
{
  "closing_narrative": "el cierre épico de la aventura (max 200 palabras)",
  "is_final": true
}`

// Llama al Director para planificar la primera sesión de una historia.
// Guarda story_lore, current_event_briefing y current_event_order en Supabase.
// Devuelve el resultado del Director (incluye opening_hint para el narrador).
export async function initializeStorySession(sessionId, storyContent, template) {
  const firstEvent = template.events.find(e => e.order === 1)
  const userPrompt = `Historia:\n${storyContent}\n\nPlantilla de dificultad: ${template.name} (${template.description})\n\nPrimer evento a adaptar: ${JSON.stringify(firstEvent)}\n\nGenera el story_lore, el event_briefing del primer evento y el opening_hint.`

  let result
  try {
    const raw = await callDirectorModel(DIRECTOR_SYSTEM_PROMPT, userPrompt)
    if (!raw) return null
    result = JSON.parse(raw)
  } catch (err) {
    console.error('[director] Error al inicializar historia:', err)
    return null
  }

  await supabase.from('sessions').update({
    story_lore: result.story_lore || null,
    current_event_briefing: result.event_briefing || null,
    current_event_order: 1,
    current_beats: result.beats || null,
    current_beat_index: 0,
    current_beat_turns_used: 0,
  }).eq('id', sessionId)

  console.log('[director] Historia inicializada, primer evento:', firstEvent?.type)
  return result
}

// Llama al Director cuando el evento actual se completa.
// Si es el evento final, inserta narrativa de cierre y marca la sesión como terminada.
// Si no, inserta la transición y actualiza el briefing del siguiente evento.
export async function advanceToNextEvent(session, template) {
  const currentOrder = session.current_event_order || 1
  const currentEvent = template.events.find(e => e.order === currentOrder)
  if (!currentEvent) return null

  if (currentEvent.is_final) {
    // Último evento: pedir cierre épico
    const userPrompt = `Lore de la historia:\n${session.story_lore}\n\nEvento final completado: ${JSON.stringify(currentEvent)}\n\nGenera la narrativa de cierre épico de la aventura.`
    let result
    try {
      const raw = await callDirectorModel(DIRECTOR_SYSTEM_PROMPT, userPrompt)
      if (!raw) return null
      result = JSON.parse(raw)
    } catch (err) {
      console.error('[director] Error generando cierre:', err)
      return null
    }

    // Insertar cierre como mensaje del narrador y marcar sesión como terminada
    if (result.closing_narrative) {
      await supabase.from('messages').insert({
        session_id: session.id, character_id: 'narrator',
        content: result.closing_narrative, type: 'narrator',
      })
    }
    await supabase.from('sessions').update({ status: 'finished' }).eq('id', session.id)
    console.log('[director] Aventura completada, sesión marcada como terminada')
    return { ...result, is_final: true }
  }

  // Evento no final: avanzar al siguiente
  const nextOrder = currentOrder + 1
  const nextEvent = template.events.find(e => e.order === nextOrder)
  if (!nextEvent) return null

  const userPrompt = `Lore de la historia:\n${session.story_lore}\n\nEvento completado: ${JSON.stringify(currentEvent)}\n\nSiguiente evento a adaptar: ${JSON.stringify(nextEvent)}\n\nGenera la transición narrativa y el briefing del nuevo evento.`

  let result
  try {
    const raw = await callDirectorModel(DIRECTOR_SYSTEM_PROMPT, userPrompt)
    if (!raw) return null
    result = JSON.parse(raw)
  } catch (err) {
    console.error('[director] Error avanzando evento:', err)
    return null
  }

  // Guardar nuevo briefing, beats y avanzar el orden
  await supabase.from('sessions').update({
    current_event_order: nextOrder,
    current_event_briefing: result.event_briefing || null,
    current_beats: result.beats || null,
    current_beat_index: 0,
    current_beat_turns_used: 0,
  }).eq('id', session.id)

  // Insertar transición como mensaje del narrador
  if (result.transition_narrative) {
    await supabase.from('messages').insert({
      session_id: session.id, character_id: 'narrator',
      content: result.transition_narrative, type: 'narrator',
    })
  }

  console.log(`[director] Avanzado al evento ${nextOrder}:`, nextEvent?.type)
  return result
}
