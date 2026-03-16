import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { groq } from '../lib/groq'
import { NARRATOR_SYSTEM_PROMPT } from '../lib/narrator'
import { characters as allCharacters } from '../data/characters'

const NARRATOR_CONTEXT_MESSAGES = 25

export function useMessages(session, activeCharacter, presentIds = []) {
  const [messages, setMessages] = useState([])
  const [characterStates, setCharacterStates] = useState([])
  const [sending, setSending] = useState(false)
  const [diceRequest, setDiceRequest] = useState({ required: false, count: 1 })
  const subscriptionRef = useRef(null)
  const characterStatesSubRef = useRef(null)
  const messagesRef = useRef([])
  const characterStatesRef = useRef([])
  const presentIdsRef = useRef(presentIds)
  // Evitar que varios clientes lancen la introducción a la vez
  const openingRequestedRef = useRef(false)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    characterStatesRef.current = characterStates
  }, [characterStates])

  useEffect(() => {
    presentIdsRef.current = presentIds
  }, [presentIds])

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
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error cargando mensajes:', error)
      return
    }

    setMessages(data || [])

    // Si la sesión es nueva (sin mensajes), pedir la introducción al narrador
    if (data?.length === 0 && !openingRequestedRef.current) {
      openingRequestedRef.current = true
      await requestOpeningNarration()
    }
  }

  async function loadCharacterStates() {
    const { data, error } = await supabase
      .from('session_character_state')
      .select('*')
      .eq('session_id', session.id)

    if (error) console.error('Error cargando estados de personajes:', error)
    else setCharacterStates(data || [])
  }

  function subscribeToMessages() {
    subscriptionRef.current = supabase
      .channel(`messages:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()
  }

  // Suscribirse a cambios de vida e inventario para actualizar el panel lateral en tiempo real
  function subscribeToCharacterStates() {
    characterStatesSubRef.current = supabase
      .channel(`char-states:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_character_state', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setCharacterStates(prev =>
            prev.map(s => s.character_id === payload.new.character_id ? { ...s, ...payload.new } : s)
          )
        }
      )
      .subscribe()
  }

  // Narración de apertura automática en sesiones nuevas
  async function requestOpeningNarration() {
    setSending(true)
    const characterContext = buildCharacterContext()
    const firstCharacter = allCharacters.find(c => c.id === session.current_turn_character_id)
    const activeIds = presentIdsRef.current

    const openingPrompt = `## Personajes activos en esta sesión
${characterContext}

## Inicio de aventura
La partida acaba de comenzar. Presenta la escena inicial de forma evocadora: dónde están, qué ven, qué se siente en el ambiente. Luego dirige la palabra al primer jugador en turno: ${firstCharacter?.name} (${firstCharacter?.role}).

Los únicos ids válidos para next_character_id son: ${activeIds.join(', ')}

Recuerda: responde ÚNICAMENTE con el objeto JSON indicado, con is_action: true.`

    await callGroq(openingPrompt, { forceAction: true })
    setSending(false)
  }

  // Aplica los cambios de vida devueltos por el narrador en session_character_state
  async function applyStatUpdates(updates) {
    for (const { character_id, hp_delta } of updates) {
      const current = characterStatesRef.current.find(s => s.character_id === character_id)
      if (!current) continue
      const newHp = Math.max(0, current.hp_current + hp_delta)
      await supabase
        .from('session_character_state')
        .update({ hp_current: newHp })
        .eq('session_id', session.id)
        .eq('character_id', character_id)
      // Actualizar estado local inmediatamente sin esperar al Realtime
      setCharacterStates(prev =>
        prev.map(s => s.character_id === character_id ? { ...s, hp_current: newHp } : s)
      )
    }
  }

  // Tirada de dados: genera el resultado, lo guarda en el chat y llama al narrador
  async function rollDice() {
    if (sending) return
    const { count } = diceRequest
    const rolls = Array.from({ length: count }, () => Math.ceil(Math.random() * 6))
    const total = rolls.reduce((a, b) => a + b, 0)
    const content = count === 1
      ? `🎲 ${rolls[0]} = ${total}`
      : `🎲 ${rolls.join(' + ')} = ${total}`

    setDiceRequest({ required: false, count: 1 })
    setSending(true)

    await supabase.from('messages').insert({
      session_id: session.id,
      character_id: activeCharacter.id,
      content,
      type: 'dice',
    })

    await callNarrator(`[Tirada de dados: ${content}]`)
    setSending(false)
  }

  async function sendMessage(content) {
    if (!content.trim() || sending) return
    setSending(true)

    const { error } = await supabase
      .from('messages')
      .insert({
        session_id: session.id,
        character_id: activeCharacter.id,
        content: content.trim(),
        type: 'player',
      })

    if (error) {
      console.error('Error guardando mensaje:', error)
      setSending(false)
      return
    }

    // Solo el jugador en turno activa al narrador
    const isMyTurn = session.current_turn_character_id === activeCharacter.id
    if (isMyTurn) {
      await callNarrator(content.trim())
    }

    setSending(false)
  }

  // Acción de emote (/comando): visible para todos, activa narrador si es tu turno
  async function sendAction(action) {
    if (!action.trim() || sending) return
    setSending(true)

    await supabase.from('messages').insert({
      session_id: session.id,
      character_id: activeCharacter.id,
      content: action.trim(),
      type: 'action',
    })

    const isMyTurn = session.current_turn_character_id === activeCharacter.id
    if (isMyTurn) {
      await callNarrator(`[${activeCharacter.name} realiza una acción: ${action.trim()}]`)
    }

    setSending(false)
  }

  // Instrucción al narrador (/gm): siempre activa al narrador, independientemente del turno
  async function sendGmMessage(instruction) {
    if (!instruction.trim() || sending) return
    setSending(true)

    await supabase.from('messages').insert({
      session_id: session.id,
      character_id: activeCharacter.id,
      content: instruction.trim(),
      type: 'gm',
    })

    await callNarrator(`[Instrucción del maestro de juego: ${instruction.trim()}]`)
    setSending(false)
  }

  async function callNarrator(lastPlayerMessage) {
    const recentMessages = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES)
    const chatHistory = recentMessages.map(m => {
      const name = m.character_id === 'narrator'
        ? 'Narrador'
        : allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    const activeIds = presentIdsRef.current

    const userPrompt = `## Personajes activos en esta sesión
${buildCharacterContext()}

## Historial reciente
${chatHistory}
${activeCharacter.name}: ${lastPlayerMessage}

Los únicos ids válidos para next_character_id son: ${activeIds.join(', ')}
Si solo hay un jugador activo, next_character_id debe ser siempre ese mismo.

Narra la respuesta y decide a quién le toca actuar a continuación. Recuerda: responde ÚNICAMENTE con el objeto JSON indicado.`

    await callGroq(userPrompt)
  }

  // Llamada a Groq y gestión de la respuesta
  async function callGroq(userPrompt, { forceAction = false } = {}) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: NARRATOR_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.85,
      })

      const raw = completion.choices[0]?.message?.content?.trim()
      if (!raw) return

      let isAction = true
      let narrative = raw
      let nextCharacterId = null
      let diceRequired = false
      let diceCount = 1
      let statUpdates = []

      try {
        // Extraer el objeto JSON aunque el modelo añada texto antes/después o code fences
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('No JSON found')
        const parsed = JSON.parse(match[0])
        isAction = forceAction || parsed.is_action !== false
        narrative = parsed.narrative || raw
        nextCharacterId = parsed.next_character_id || null
        diceRequired = parsed.dice_required === true
        diceCount = parsed.dice_count === 2 ? 2 : 1
        statUpdates = Array.isArray(parsed.stat_updates) ? parsed.stat_updates : []
      } catch {
        console.warn('El narrador no devolvió JSON válido, usando respuesta en bruto')
      }

      if (!isAction) return

      await supabase.from('messages').insert({
        session_id: session.id,
        character_id: 'narrator',
        content: narrative,
        type: 'narrator',
      })

      if (statUpdates.length > 0) {
        await applyStatUpdates(statUpdates)
      }

      if (diceRequired) {
        setDiceRequest({ required: true, count: diceCount })
      }

      // Actualizar el turno siempre que haya next_character_id — si hay dados pendientes,
      // el turno apunta a quien debe tirar; tras la tirada el narrador lo actualizará de nuevo
      if (nextCharacterId && allCharacters.some(c => c.id === nextCharacterId)) {
        await supabase
          .from('sessions')
          .update({ current_turn_character_id: nextCharacterId })
          .eq('id', session.id)
      }
    } catch (err) {
      console.error('Error llamando al narrador:', err)
    }
  }

  function buildCharacterContext() {
    // Solo personajes presentes (conectados vía Presence) participan en la sesión
    const activeIds = presentIdsRef.current
    const activeStates = characterStates.filter(s => activeIds.includes(s.character_id))

    return allCharacters
      .filter(c => activeIds.includes(c.id))
      .map(c => {
        const state = activeStates.find(s => s.character_id === c.id)
        const hp = state ? state.hp_current : c.hp
        const inventory = state?.inventory?.length
          ? state.inventory.map(i => i.name).join(', ')
          : 'sin objetos'
        return `- ${c.name} (${c.role}): Vida ${hp}/${c.hp} | Ataque ${c.attack} | Defensa ${c.defense} | Navegación ${c.navigation} | Habilidad: ${c.ability.name} | Inventario: ${inventory}`
      }).join('\n')
  }

  return { messages, sending, sendMessage, sendAction, sendGmMessage, diceRequest, rollDice, characterStates }
}
