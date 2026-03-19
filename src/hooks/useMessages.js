import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { callMechanicsModel, callNarratorModel } from '../lib/groq'
import { MECHANICS_SYSTEM_PROMPT, NARRATOR_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from '../lib/narrator'
import { characters as allCharacters } from '../data/characters'

const NARRATOR_CONTEXT_MESSAGES = 10
const SUMMARY_EVERY_N_MESSAGES = 10

export function useMessages(session, activeCharacter, presentIds = []) {
  const [messages, setMessages] = useState([])
  const [characterStates, setCharacterStates] = useState([])
  const [sending, setSending] = useState(false)
  const [narratorTyping, setNarratorTyping] = useState(false)
  const [diceRequest, setDiceRequest] = useState({ required: false, count: 1 })
  const [narrativeSummary, setNarrativeSummary] = useState(session?.narrative_summary || '')
  const subscriptionRef = useRef(null)
  const characterStatesSubRef = useRef(null)
  const messagesRef = useRef([])
  const characterStatesRef = useRef([])
  const presentIdsRef = useRef(presentIds)
  const narrativeSummaryRef = useRef(session?.narrative_summary || '')
  // Guarda el resultado del modelo mecánico mientras el jugador tira los dados
  const pendingMechanicsRef = useRef(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { narrativeSummaryRef.current = narrativeSummary }, [narrativeSummary])
  useEffect(() => { characterStatesRef.current = characterStates }, [characterStates])
  useEffect(() => { presentIdsRef.current = presentIds }, [presentIds])

  useEffect(() => {
    if (!session) return
    loadMessages()
    loadCharacterStates()
    subscribeToMessages()
    subscribeToCharacterStates()
    return () => {
      subscriptionRef.current?.unsubscribe()
      characterStatesSubRef.current?.unsubscribe()
    }
  }, [session?.id])

  async function loadMessages() {
    const [{ data: msgs, error }, { data: sessionData }] = await Promise.all([
      supabase.from('messages').select('*').eq('session_id', session.id).order('created_at', { ascending: true }),
      supabase.from('sessions').select('narrative_summary').eq('id', session.id).single(),
    ])
    if (error) { console.error('Error cargando mensajes:', error); return }
    setMessages(msgs || [])
    if (sessionData?.narrative_summary) setNarrativeSummary(sessionData.narrative_summary)
  }

  async function loadCharacterStates() {
    const { data, error } = await supabase
      .from('session_character_state').select('*').eq('session_id', session.id)
    if (error) console.error('Error cargando estados de personajes:', error)
    else setCharacterStates(data || [])
  }

  function subscribeToMessages() {
    subscriptionRef.current = supabase
      .channel(`messages:${session.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        }
      ).subscribe()
  }

  // Suscribirse a cambios de vida e inventario para actualizar el panel lateral en tiempo real
  function subscribeToCharacterStates() {
    characterStatesSubRef.current = supabase
      .channel(`char-states:${session.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_character_state', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setCharacterStates(prev =>
            prev.map(s => s.character_id === payload.new.character_id ? { ...s, ...payload.new } : s)
          )
        }
      ).subscribe()
  }

  // --- Helpers ---

  function buildCharacterContext() {
    const activeIds = presentIdsRef.current
    const activeStates = characterStatesRef.current.filter(s => activeIds.includes(s.character_id))
    return allCharacters
      .filter(c => activeIds.includes(c.id))
      .map(c => {
        const state = activeStates.find(s => s.character_id === c.id)
        const hp = state ? state.hp_current : c.hp
        const inventory = state?.inventory?.length
          ? state.inventory.map(i => i.name).join(', ')
          : 'sin objetos'
        return `- ${c.name}(${c.role}) HP${hp}/${c.hp} ATK${c.attack} DEF${c.defense} NAV${c.navigation} [${c.ability.name}] ${inventory}`
      }).join('\n')
  }

  // Devuelve el personaje presente con menos intervenciones recientes
  function getLeastActive() {
    const activeIds = presentIdsRef.current
    const recentMessages = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES)
    const counts = Object.fromEntries(activeIds.map(id => [id, 0]))
    for (const m of recentMessages) {
      if (m.character_id in counts) counts[m.character_id]++
    }
    return [...activeIds].sort((a, b) => counts[a] - counts[b])[0]
  }

  // JSON por defecto si el modelo mecánico falla — pasa el turno sin efectos
  function getDefaultMechanics() {
    const leastActive = getLeastActive()
    return {
      dice_required: false, dice_count: 1, dice_stat: null, dice_threshold: null,
      next_character_id: leastActive || presentIdsRef.current[0] || null,
      stat_updates: [], inventory_updates: [],
      event_type: null, combat_details: null, session_event: null,
    }
  }

  // Prompt para el modelo mecánico: personajes + historial comprimido + acción
  function buildMechanicsPrompt(playerAction, isGm = false) {
    const activeIds = presentIdsRef.current
    const leastActive = getLeastActive()
    const summary = narrativeSummaryRef.current
    const compactHistory = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES).map(m => {
      if (m.character_id === 'narrator') return `N: ${m.content.slice(0, 100)}`
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    return `## Personajes
${buildCharacterContext()}
${summary ? `## Resumen\n${summary}\n` : ''}## Historial reciente
${compactHistory}

## Acción${isGm ? ' (instrucción GM)' : ''}: ${activeCharacter.name} → ${playerAction}
## Presentes: ${activeIds.join(', ')} | next preferido: ${leastActive} | no repetir: ${activeCharacter.id} salvo si es el único`
  }

  // Prompt para el modelo narrador: contexto completo + JSON mecánico ya resuelto
  function buildNarratorPrompt(playerAction, mechanics, diceResult) {
    const summary = narrativeSummaryRef.current
    const chatHistory = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES).map(m => {
      if (m.character_id === 'narrator') {
        const text = m.content.length > 200 ? m.content.slice(0, 200) + '…' : m.content
        return `Narrador: ${text}`
      }
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    const nextChar = allCharacters.find(c => c.id === mechanics.next_character_id)

    return `## Personajes en sesión
${buildCharacterContext()}
${summary ? `## Resumen de la sesión\n${summary}\n` : ''}## Historial reciente
${chatHistory}

## Acción de ${activeCharacter.name}:
${playerAction}
${diceResult ? `## Resultado de dados:\n${diceResult}${mechanics.dice_threshold ? ` (umbral para éxito: ${mechanics.dice_threshold})` : ''}\n` : ''}## Decisiones mecánicas (ya resueltas — nárralas):
${JSON.stringify(mechanics)}

Termina interpelando a: ${nextChar?.name || mechanics.next_character_id}`
  }

  // --- Aplicar efectos mecánicos ---

  async function applyStatUpdates(updates) {
    for (const { character_id, hp_delta } of updates) {
      const current = characterStatesRef.current.find(s => s.character_id === character_id)
      if (!current) continue
      const newHp = Math.max(0, current.hp_current + hp_delta)
      await supabase.from('session_character_state')
        .update({ hp_current: newHp })
        .eq('session_id', session.id).eq('character_id', character_id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === character_id ? { ...s, hp_current: newHp } : s)
      )
    }
  }

  async function applyInventoryUpdates(updates) {
    for (const update of updates) {
      const { character_id, action, item, item_name } = update
      const current = characterStatesRef.current.find(s => s.character_id === character_id)
      if (!current) continue
      let newInventory = [...(current.inventory || [])]
      if (action === 'add' && item) {
        newInventory = [...newInventory, item]
      } else if (action === 'remove') {
        const name = item_name || item?.name
        newInventory = newInventory.filter(i => i.name !== name)
      }
      await supabase.from('session_character_state')
        .update({ inventory: newInventory })
        .eq('session_id', session.id).eq('character_id', character_id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === character_id ? { ...s, inventory: newInventory } : s)
      )
    }
  }

  // --- Motor principal de dos modelos ---

  // Paso 1: modelo mecánico determina qué pasa
  // Paso 2: modelo narrador cuenta cómo ocurre
  async function processAction(playerAction, { isGm = false } = {}) {
    setNarratorTyping(true)
    // Modelo mecánico
    let mechanics = getDefaultMechanics()
    try {
      const raw = await callMechanicsModel(MECHANICS_SYSTEM_PROMPT, buildMechanicsPrompt(playerAction, isGm), { useTools: true })
      if (raw) {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) mechanics = { ...mechanics, ...JSON.parse(match[0]) }
      }
    } catch (err) {
      console.warn('Modelo mecánico falló, usando defaults:', err)
    }

    // Correcciones de turno en código (no depender solo del modelo)
    if (mechanics.dice_required) {
      // Con dados pendientes, el turno queda con quien debe tirar
      mechanics.next_character_id = activeCharacter.id
    } else {
      // Evitar que el mismo personaje repita turno si hay más presentes
      const activeIds = presentIdsRef.current
      if (mechanics.next_character_id === activeCharacter.id && activeIds.length > 1) {
        mechanics.next_character_id = getLeastActive()
      }
    }

    if (mechanics.dice_required) {
      // Guardar contexto mecánico y esperar al jugador
      pendingMechanicsRef.current = { mechanics, playerAction }
      setDiceRequest({ required: true, count: mechanics.dice_count || 1 })
      setNarratorTyping(false)
      return
    }

    await deliverNarrative(playerAction, mechanics, null)
    setNarratorTyping(false)
  }

  // Llama al modelo narrador con todo el contexto y aplica los efectos
  async function deliverNarrative(playerAction, mechanics, diceResult) {
    const narrative = await callNarratorModel(NARRATOR_SYSTEM_PROMPT, buildNarratorPrompt(playerAction, mechanics, diceResult))
    if (!narrative) return

    await supabase.from('messages').insert({
      session_id: session.id,
      character_id: 'narrator',
      content: narrative,
      type: 'narrator',
    })

    if (mechanics.stat_updates?.length > 0) await applyStatUpdates(mechanics.stat_updates)
    if (mechanics.inventory_updates?.length > 0) await applyInventoryUpdates(mechanics.inventory_updates)

    if (mechanics.next_character_id && presentIdsRef.current.includes(mechanics.next_character_id)) {
      await supabase.from('sessions')
        .update({ current_turn_character_id: mechanics.next_character_id })
        .eq('id', session.id)
    }

    // Actualizar resumen cada N mensajes de jugador (solo el cliente activo lo dispara)
    const playerMessages = messagesRef.current.filter(m => m.type === 'player' || m.type === 'action')
    if (playerMessages.length > 0 && playerMessages.length % SUMMARY_EVERY_N_MESSAGES === 0) {
      updateNarrativeSummary()
    }
  }

  // --- Acciones del jugador ---

  async function sendMessage(content) {
    if (!content.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: content.trim(), type: 'player',
    })
    if (error) { console.error('Error guardando mensaje:', error); setSending(false); return }

    const isMyTurn = session.current_turn_character_id === activeCharacter.id
    if (isMyTurn) await processAction(content.trim())
    setSending(false)
  }

  // Acción de emote (/acción): visible para todos, activa al narrador si es tu turno
  async function sendAction(action) {
    if (!action.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: action.trim(), type: 'action',
    })
    const isMyTurn = session.current_turn_character_id === activeCharacter.id
    if (isMyTurn) await processAction(`[${activeCharacter.name} realiza una acción: ${action.trim()}]`)
    setSending(false)
  }

  // Mensaje de conversación: visible para todos, no activa al narrador
  async function sendChat(content) {
    if (!content.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: content.trim(), type: 'player',
    })
    setSending(false)
  }

  // Instrucción al narrador (/gm): va directo al narrador, sin pasar por el modelo mecánico
  async function sendGmMessage(instruction) {
    if (!instruction.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: instruction.trim(), type: 'gm',
    })

    setNarratorTyping(true)
    try {
      const summary = narrativeSummaryRef.current
      const chatHistory = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES).map(m => {
        if (m.character_id === 'narrator') return `N: ${m.content.slice(0, 200)}`
        const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
        return `${name}: ${m.content}`
      }).join('\n')

      // La instrucción GM va en el system prompt para máxima prioridad
      const gmSystemPrompt = `${NARRATOR_SYSTEM_PROMPT}\n\n## INSTRUCCIÓN ACTIVA DEL MAESTRO DE JUEGO — PRIORIDAD ABSOLUTA:\n${instruction.trim()}\nDebes ejecutar esta instrucción exactamente. Tiene prioridad sobre el hilo narrativo actual. No la ignores ni la suavices.`

      const gmPrompt = `## Personajes en sesión\n${buildCharacterContext()}\n${summary ? `## Resumen\n${summary}\n` : ''}## Historial reciente\n${chatHistory}\n\nNarra siguiendo la instrucción del GM. Termina interpelando al personaje cuyo turno corresponda.`

      const narrative = await callNarratorModel(gmSystemPrompt, gmPrompt)
      if (narrative) {
        await supabase.from('messages').insert({
          session_id: session.id, character_id: 'narrator',
          content: narrative, type: 'narrator',
        })
      }
    } catch (err) {
      console.error('Error en sendGmMessage:', err)
    }
    setNarratorTyping(false)
    setSending(false)
  }

  // Tirada de dados: genera resultado, lo guarda y entrega la narrativa con el contexto mecánico pendiente
  async function rollDice() {
    if (sending) return
    const { count } = diceRequest
    const rolls = Array.from({ length: count }, () => Math.ceil(Math.random() * 6))
    const total = rolls.reduce((a, b) => a + b, 0)
    const content = count === 1 ? `🎲 ${rolls[0]} = ${total}` : `🎲 ${rolls.join(' + ')} = ${total}`

    setDiceRequest({ required: false, count: 1 })
    setSending(true)

    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content, type: 'dice',
    })

    const pending = pendingMechanicsRef.current
    pendingMechanicsRef.current = null

    const mechanics = pending?.mechanics || getDefaultMechanics()
    const playerAction = pending?.playerAction || `[Tirada de dados: ${content}]`

    setNarratorTyping(true)
    await deliverNarrative(playerAction, mechanics, content)
    setNarratorTyping(false)
    setSending(false)
  }

  // Inicio manual de partida — con check de race condition
  async function startGame() {
    if (sending) return
    const { data: existing } = await supabase
      .from('messages').select('id').eq('session_id', session.id).limit(1)
    if (existing?.length > 0) return

    setSending(true)
    const activeIds = presentIdsRef.current
    const firstCharacter = allCharacters.find(c => c.id === activeIds[0])

    const openingPrompt = `## Personajes en sesión
${buildCharacterContext()}

## Inicio de partida
Partida nueva. Presenta la escena inicial de forma evocadora e interpela al primer jugador: ${firstCharacter?.name} (${firstCharacter?.role}).
Personajes presentes: ${activeIds.join(', ')}.`

    setNarratorTyping(true)
    const narrative = await callNarratorModel(NARRATOR_SYSTEM_PROMPT, openingPrompt)
    setNarratorTyping(false)
    if (narrative) {
      await supabase.from('messages').insert({
        session_id: session.id, character_id: 'narrator',
        content: narrative, type: 'narrator',
      })
      if (firstCharacter) {
        await supabase.from('sessions')
          .update({ current_turn_character_id: firstCharacter.id })
          .eq('id', session.id)
      }
    }
    setSending(false)
  }

  // Anunciar entrada de un personaje que llega a la sesión en curso
  async function announceEntry() {
    if (sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: `${activeCharacter.name} entra en la sala.`, type: 'action',
    })
    setSending(false)
  }

  // Resumen incremental: modelo mecánico (8b) para coste mínimo
  async function updateNarrativeSummary() {
    const recentForSummary = messagesRef.current.slice(-SUMMARY_EVERY_N_MESSAGES).map(m => {
      if (m.character_id === 'narrator') return `N: ${m.content.slice(0, 150)}`
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    const currentSummary = narrativeSummaryRef.current
    const userContent = currentSummary
      ? `Resumen actual:\n${currentSummary}\n\nNuevos eventos:\n${recentForSummary}\n\nActualiza el resumen incorporando los nuevos eventos. Máximo 120 palabras.`
      : `Resume estos eventos de rol en máximo 120 palabras:\n\n${recentForSummary}`

    try {
      const summary = await callMechanicsModel(SUMMARY_SYSTEM_PROMPT, userContent, { json: false, maxTokens: 200, temperature: 0.3 })
      if (!summary) return
      setNarrativeSummary(summary)
      await supabase.from('sessions').update({ narrative_summary: summary }).eq('id', session.id)
    } catch (err) {
      console.error('Error actualizando resumen narrativo:', err)
    }
  }

  // Solo en desarrollo — añade un item de prueba al inventario del personaje activo
  async function debugAddItem(item) {
    const current = characterStatesRef.current.find(s => s.character_id === activeCharacter.id)
    if (!current) return
    const newInventory = [...(current.inventory || []), item]
    await supabase.from('session_character_state')
      .update({ inventory: newInventory })
      .eq('session_id', session.id).eq('character_id', activeCharacter.id)
    setCharacterStates(prev =>
      prev.map(s => s.character_id === activeCharacter.id ? { ...s, inventory: newInventory } : s)
    )
  }

  return { messages, sending, narratorTyping, sendMessage, sendChat, sendAction, sendGmMessage, diceRequest, rollDice, characterStates, startGame, announceEntry, debugAddItem }
}
