// Director de Guion — planifica y gestiona los eventos de una historia
// Usa el modelo más inteligente disponible (kimi-k2) porque la latencia no es crítica aquí.

import { supabase } from './supabase'
import { callDirectorModel } from './groq'
import { generateAndSaveRecap } from './recap'

// Prompt para rellenar el texto de un único nodo del árbol de exploración
const NODE_TEXT_SYSTEM_PROMPT = `Eres el Director de Guion de un juego de rol.
Devuelve SOLO JSON válido, sin texto adicional:
{"description":"texto evocador del lugar en 1-2 frases","labels":["label1","label2",...]}
- description: descripción breve y evocadora del lugar (nunca vacía, nunca "...")
- labels: un label corto y accionable por opción ("Forzar la cerradura", "Seguir el rastro húmedo"...)
- Nunca devuelvas strings vacíos, nunca uses "→" ni "Opción N" como label
- Adapta todo al lore y al contexto del evento`

// Genera el esqueleto fijo del árbol: 8 nodos, 3 opciones por nodo no-goal, 1 salida en el goal.
// Ruta al objetivo: loc0 → loc2 → loc5 → loc6 → loc7
// El resto son ramas que vuelven a loc0.
function generateTreeSkeleton() {
  return {
    start_node_id: 'loc0',
    nodes: [
      { id: 'loc0', is_goal: false, description: '', options: [{ label: '', next_node_id: 'loc1' }, { label: '', next_node_id: 'loc2' }, { label: '', next_node_id: 'loc3' }] },
      { id: 'loc1', is_goal: false, description: '', _hint: 'callejon', options: [{ label: '', next_node_id: 'loc0' }, { label: '', next_node_id: 'loc4' }, { label: '', next_node_id: 'loc3' }] },
      { id: 'loc2', is_goal: false, description: '', _hint: 'ruta_correcta', options: [{ label: '', next_node_id: 'loc5' }, { label: '', next_node_id: 'loc1' }, { label: '', next_node_id: 'loc0' }] },
      { id: 'loc3', is_goal: false, description: '', _hint: 'callejon', options: [{ label: '', next_node_id: 'loc0' }, { label: '', next_node_id: 'loc1' }, { label: '', next_node_id: 'loc4' }] },
      { id: 'loc4', is_goal: false, description: '', _hint: 'callejon', options: [{ label: '', next_node_id: 'loc0' }, { label: '', next_node_id: 'loc3' }, { label: '', next_node_id: 'loc1' }] },
      { id: 'loc5', is_goal: false, description: '', _hint: 'ruta_correcta', options: [{ label: '', next_node_id: 'loc6' }, { label: '', next_node_id: 'loc0' }, { label: '', next_node_id: 'loc4' }] },
      { id: 'loc6', is_goal: false, description: '', _hint: 'ruta_correcta', options: [{ label: '', next_node_id: 'loc7' }, { label: '', next_node_id: 'loc0' }, { label: '', next_node_id: 'loc5' }] },
      { id: 'loc7', is_goal: true,  description: '', options: [{ label: '', next_node_id: 'loc0' }] },
    ],
  }
}

// Prompt para generar consecuencia narrativa cuando la negociación falla
const NEGOTIATION_FAILURE_SYSTEM_PROMPT = `Genera una consecuencia narrativa breve para el fallo de una negociación en una partida de rol.
Devuelve SOLO JSON: {"consequence":"texto narrativo dramático de máx. 80 palabras — qué ocurre cuando el NPC rechaza definitivamente a los jugadores"}`

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

// Carga el lore de una historia desde la tabla stories de Supabase.
export async function loadStory(storyId) {
  const { data, error } = await supabase.from('stories').select('*').eq('id', storyId).single()
  if (error) { console.error('[director] Error cargando historia:', error); return null }
  return data
}

// Llama al Director para planificar la primera sesión de una historia.
// Guarda story_lore, current_event_briefing y current_event_order en Supabase.
// Devuelve el resultado del Director (incluye opening_hint para el narrador).
// storyId: UUID de la tabla stories
export async function initializeStorySession(sessionId, storyId, template) {
  const story = await loadStory(storyId)
  if (!story) { console.error('[director] Historia no encontrada:', storyId); return null }
  const storyContent = story.lore

  // Cargar ubicaciones existentes para coherencia del mundo
  const { data: existingLocations } = await supabase
    .from('world_locations')
    .select('name, description, location_type')
    .limit(10)
  const locationContext = existingLocations?.length
    ? `\n\nUbicaciones ya descubiertas en el mundo:\n${existingLocations.map(l => `- ${l.name} (${l.location_type}): ${l.description?.slice(0, 60) || ''}`).join('\n')}\nPuedes referenciar estos lugares o sugerir destinos coherentes con el grafo existente.`
    : ''

  const firstEvent = template.events.find(e => e.order === 1)
  const userPrompt = `Historia:\n${storyContent}\n\nPlantilla de dificultad: ${template.name} (${template.description})\n\nPrimer evento a adaptar: ${JSON.stringify(firstEvent)}${locationContext}\n\nGenera el story_lore, el event_briefing del primer evento y el opening_hint.`

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

// Llama al Director para rellenar los textos de un único nodo.
// Devuelve { description, labels } o null si falla.
async function fillNodeText(node, loreContext) {
  const roleHint = node.is_goal
    ? 'Este es el descubrimiento final. Su description debe sentirse como la recompensa de la exploración.'
    : node._hint === 'ruta_correcta'
    ? 'Este nodo está en el camino al descubrimiento. Su description puede contener una pista sutil que lo distinga.'
    : 'Este nodo es un callejón — un lugar interesante pero que no lleva directamente al objetivo.'

  const optCount = node.options.length
  const userPrompt = `${loreContext}${roleHint}\nGenera description y exactamente ${optCount} label${optCount !== 1 ? 's' : ''}.`

  try {
    const raw = await callDirectorModel(NODE_TEXT_SYSTEM_PROMPT, userPrompt)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Genera un árbol de exploración y lo fusiona en game_mode_data de la sesión.
// El código construye la estructura; el Director rellena textos nodo a nodo en paralelo.
export async function generateExplorationTree(sessionId, storyLore, eventBriefing) {
  const skeleton = generateTreeSkeleton()
  const loreContext = `${storyLore ? `Lore:\n${storyLore}\n\n` : ''}${eventBriefing ? `Evento de exploración:\n${eventBriefing}\n\n` : ''}`

  // Una llamada por nodo, todas en paralelo
  const results = await Promise.all(skeleton.nodes.map(node => fillNodeText(node, loreContext)))

  // Ensamblar árbol: esqueleto como fuente de verdad + textos del Director + fallbacks
  const FALLBACK_LABELS = ['Explorar por aquí', 'Investigar', 'Continuar', 'Avanzar', 'Examinar']
  const finalNodes = skeleton.nodes.map((skelNode, i) => {
    const filled = results[i]
    const { _hint, ...nodeWithoutHint } = skelNode
    return {
      ...nodeWithoutHint,
      description: filled?.description || 'Un lugar envuelto en misterio.',
      options: skelNode.options.map((opt, j) => ({
        ...opt,
        label: filled?.labels?.[j] || FALLBACK_LABELS[j % FALLBACK_LABELS.length],
      })),
    }
  })
  const tree = { start_node_id: skeleton.start_node_id, nodes: finalNodes }

  // Fusionar el árbol en el game_mode_data actual de la sesión
  const { data: sessionData } = await supabase.from('sessions').select('game_mode_data').eq('id', sessionId).single()
  const mergedData = { ...(sessionData?.game_mode_data || {}), exploration_tree: tree }
  await supabase.from('sessions').update({ game_mode_data: mergedData }).eq('id', sessionId)
  // Log del árbol completo para verificar alcanzabilidad del nodo goal
  console.log('[director] Árbol de exploración generado:', tree.nodes.length, 'nodos')
  console.log('[director] start_node_id:', tree.start_node_id)
  for (const node of tree.nodes) {
    const opts = node.options.map(o => `${o.label || '?'} → ${o.next_node_id}`).join(' | ')
    console.log(`[director]   ${node.id}${node.is_goal ? ' [GOAL]' : ''}: ${opts || '(sin opciones)'}`)
  }
  return tree
}

const NAVIGATION_EVENT_SYSTEM_PROMPT = `Eres el Director de Guion de un juego de rol. Durante la navegación, debes generar micro-eventos imprevistos y dramáticos.
Devuelve SOLO JSON válido:
{
  "type": "encounter|weather|merchant|discovery",
  "title": "Nombre breve del evento (máx. 5 palabras)",
  "description": "Descripción narrativa del evento en 2-3 frases. Usa lenguaje evocador y conecta con el lore.",
  "mechanic": "qué deben hacer los jugadores: tirada de stat concreto, decisión de equipo, gasto de berries, etc. (1 frase)"
}
- encounter: barco pirata, marine o criatura marina que aparece
- weather: tormenta, niebla, calma chicha, corriente
- merchant: barco mercante con algo interesante para comprar/intercambiar
- discovery: isla, objeto, mensaje en una botella, rastro de algo mayor`

// Genera un evento aleatorio durante la navegación.
// Probabilidad: ~12% por turno en modo navigation (gestiona el caller).
// Devuelve { type, title, description, mechanic } o null si falla.
export async function rollNavigationEvent(session) {
  const context = [
    session.story_lore ? `Lore:\n${session.story_lore}` : '',
    session.current_event_briefing ? `Evento actual:\n${session.current_event_briefing}` : '',
  ].filter(Boolean).join('\n\n')

  const userPrompt = `${context}\n\nGenera un evento inesperado durante la navegación. Debe ser coherente con el lore y aportar tensión o drama.`

  try {
    const raw = await callDirectorModel(NAVIGATION_EVENT_SYSTEM_PROMPT, userPrompt)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.error('[director] Error generando evento de navegación:', err)
    return null
  }
}

// Genera una consecuencia narrativa por fallo en negociación y la inserta como mensaje del narrador.
export async function generateNegotiationConsequence(session, npcName) {
  const userPrompt = `${session.story_lore ? `Lore:\n${session.story_lore}\n\n` : ''}${session.current_event_briefing ? `Contexto del evento:\n${session.current_event_briefing}\n\n` : ''}El NPC "${npcName || 'el interlocutor'}" ha rechazado definitivamente a los jugadores. Su convicción llegó a cero.`

  let result
  try {
    const raw = await callDirectorModel(NEGOTIATION_FAILURE_SYSTEM_PROMPT, userPrompt)
    if (!raw) return null
    result = JSON.parse(raw)
  } catch (err) {
    console.error('[director] Error generando consecuencia de negociación:', err)
    return null
  }

  const consequence = result.consequence || null
  if (consequence) {
    await supabase.from('messages').insert({
      session_id: session.id, character_id: 'narrator',
      content: consequence, type: 'narrator',
    })
  }
  return consequence
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
    // Generar recap antes de marcar como terminada (no bloquea si falla)
    try {
      await generateAndSaveRecap(session.id)
      console.log('[director] Recap generado correctamente')
    } catch (err) {
      console.error('[director] Error generando recap:', err)
    }
    await supabase.from('sessions').update({ status: 'finished' }).eq('id', session.id)
    console.log('[director] Aventura completada, sesión marcada como terminada')
    return { ...result, is_final: true }
  }

  // Evento no final: avanzar al siguiente
  const nextOrder = currentOrder + 1
  const nextEvent = template.events.find(e => e.order === nextOrder)
  if (!nextEvent) return null

  // Cargar ubicaciones existentes para transiciones coherentes
  const { data: existingLocations } = await supabase
    .from('world_locations')
    .select('name, location_type')
    .limit(10)
  const locationContext = existingLocations?.length
    ? `\nUbicaciones conocidas: ${existingLocations.map(l => l.name).join(', ')}.`
    : ''

  const userPrompt = `Lore de la historia:\n${session.story_lore}\n\nEvento completado: ${JSON.stringify(currentEvent)}\n\nSiguiente evento a adaptar: ${JSON.stringify(nextEvent)}${locationContext}\n\nGenera la transición narrativa y el briefing del nuevo evento.`

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
