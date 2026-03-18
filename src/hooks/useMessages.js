import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { groq } from '../lib/groq'
import { NARRATOR_SYSTEM_PROMPT } from '../lib/narrator'
import { characters as allCharacters } from '../data/characters'

const NARRATOR_CONTEXT_MESSAGES = 10
// Actualizar el resumen cada N mensajes de jugador
const SUMMARY_EVERY_N_MESSAGES = 10

export function useMessages(session, activeCharacter, presentIds = []) {
  const [messages, setMessages] = useState([])
  const [characterStates, setCharacterStates] = useState([])
  const [sending, setSending] = useState(false)
  const [diceRequest, setDiceRequest] = useState({ required: false, count: 1 })
  const [narrativeSummary, setNarrativeSummary] = useState(session?.narrative_summary || '')
  const subscriptionRef = useRef(null)
  const characterStatesSubRef = useRef(null)
  const messagesRef = useRef([])
  const characterStatesRef = useRef([])
  const presentIdsRef = useRef(presentIds)
  const narrativeSummaryRef = useRef(session?.narrative_summary || '')
  const openingRequestedRef = useRef(false)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    narrativeSummaryRef.current = narrativeSummary
  }, [narrativeSummary])

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
    const [{ data: msgs, error }, { data: sessionData }] = await Promise.all([
      supabase.from('messages').select('*').eq('session_id', session.id).order('created_at', { ascending: true }),
      supabase.from('sessions').select('narrative_summary').eq('id', session.id).single(),
    ])

    if (error) {
      console.error('Error cargando mensajes:', error)
      return
    }

    setMessages(msgs || [])
    if (sessionData?.narrative_summary) {
      setNarrativeSummary(sessionData.narrative_summary)
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

  // Iniciar la partida manualmente — con check de race condition para evitar doble apertura
  async function startGame() {
    if (sending) return
    const { data: existing } = await supabase
      .from('messages').select('id').eq('session_id', session.id).limit(1)
    if (existing?.length > 0) return

    setSending(true)
    const characterContext = buildCharacterContext()
    const activeIds = presentIdsRef.current
    const firstCharacter = allCharacters.find(c => c.id === activeIds[0])

    const openingPrompt = `## Personajes
${characterContext}

## Inicio
Partida nueva. Presenta la escena inicial de forma evocadora e interpela al primer jugador: ${firstCharacter?.name} (${firstCharacter?.role}).
next_character_id válidos: ${activeIds.join(', ')}`

    await callGroq(openingPrompt, { forceAction: true })
    setSending(false)
  }

  // Anunciar la entrada de un personaje que llega a la sesión en curso
  // No llama al narrador para no interrumpir la historia en curso
  async function announceEntry() {
    if (sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id,
      character_id: activeCharacter.id,
      content: `${activeCharacter.name} entra en la sala.`,
      type: 'action',
    })
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

  // Mensaje de conversación: visible para todos, no activa al narrador
  async function sendChat(content) {
    if (!content.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id,
      character_id: activeCharacter.id,
      content: content.trim(),
      type: 'player',
    })
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

  // Actualiza el resumen de forma incremental: resumen anterior + últimos N mensajes
  // Coste constante independientemente de la duración de la sesión
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
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que mantiene el registro de una sesión de rol. Anota hechos concretos: logros, descubrimientos, combates, decisiones clave, objetos obtenidos. Máximo 120 palabras. Solo el resumen, sin introducción.',
          },
          { role: 'user', content: userContent },
        ],
        max_tokens: 200,
        temperature: 0.3,
      })

      const summary = completion.choices[0]?.message?.content?.trim()
      if (!summary) return

      setNarrativeSummary(summary)
      await supabase
        .from('sessions')
        .update({ narrative_summary: summary })
        .eq('id', session.id)
    } catch (err) {
      console.error('Error actualizando resumen narrativo:', err)
    }
  }

  async function callNarrator(lastPlayerMessage) {
    const recentMessages = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES)
    const chatHistory = recentMessages.map(m => {
      if (m.character_id === 'narrator') {
        // Truncar narraciones largas — el narrador solo necesita el hilo, no el texto completo
        const text = m.content.length > 200 ? m.content.slice(0, 200) + '…' : m.content
        return `N: ${text}`
      }
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    const activeIds = presentIdsRef.current

    // Calcular quién ha intervenido menos para sugerir turno equitativo al narrador
    const actionCounts = Object.fromEntries(activeIds.map(id => [id, 0]))
    for (const m of recentMessages) {
      if (m.character_id in actionCounts) actionCounts[m.character_id]++
    }
    const leastActive = [...activeIds].sort((a, b) => actionCounts[a] - actionCounts[b])[0]

    const summary = narrativeSummaryRef.current
    const userPrompt = `## Personajes activos en esta sesión
${buildCharacterContext()}
${summary ? `\n## Resumen de la sesión\n${summary}\n` : ''}
## Historial reciente
${chatHistory}
${activeCharacter.name}: ${lastPlayerMessage}

next_character_id válidos: ${activeIds.join(', ')} — preferencia para ${leastActive} (menos activo).`

    await callGroq(userPrompt, { avoidAsNext: activeCharacter.id, fallbackNext: leastActive, activeIds })

    // Actualizar resumen cada N mensajes de jugador (solo el cliente activo lo dispara)
    const playerMessages = messagesRef.current.filter(m => m.type === 'player' || m.type === 'action')
    if (playerMessages.length > 0 && playerMessages.length % SUMMARY_EVERY_N_MESSAGES === 0) {
      updateNarrativeSummary()
    }
  }

  // Llamada a Groq y gestión de la respuesta
  async function callGroq(userPrompt, { forceAction = false, avoidAsNext = null, fallbackNext = null, activeIds: ids = null } = {}) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: NARRATOR_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.85,
        response_format: { type: 'json_object' },
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
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('No JSON found')

        // Intentar parsear; si falla, limpiar comas finales y reintentar
        let parsed
        try {
          parsed = JSON.parse(match[0])
        } catch {
          const cleaned = match[0].replace(/,(\s*[}\]])/g, '$1')
          parsed = JSON.parse(cleaned)
        }

        isAction = forceAction || parsed.is_action !== false
        narrative = parsed.narrative || null
        nextCharacterId = parsed.next_character_id || null
        diceRequired = parsed.dice_required === true
        diceCount = parsed.dice_count === 2 ? 2 : 1
        statUpdates = Array.isArray(parsed.stat_updates) ? parsed.stat_updates : []
      } catch {
        // Último recurso: extraer narrative con regex para nunca mostrar JSON en bruto
        const nm = raw.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/)
        narrative = nm ? nm[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null
        if (!narrative) {
          console.warn('El narrador no devolvió JSON parseable, descartando respuesta')
          return
        }
      }

      if (!isAction || !narrative) return

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
      // Si hay dados pendientes, el turno siempre queda con quien debe tirar (el personaje activo)
      if (diceRequired) {
        nextCharacterId = activeCharacter.id
      } else {
        // Si el narrador asigna el turno al mismo personaje que acaba de actuar y hay otros presentes, rotar
        const currentIds = ids || presentIdsRef.current
        if (avoidAsNext && nextCharacterId === avoidAsNext && currentIds.length > 1 && fallbackNext) {
          nextCharacterId = fallbackNext
        }
      }

      if (nextCharacterId && presentIdsRef.current.includes(nextCharacterId)) {
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
        return `- ${c.name}(${c.role}) HP${hp}/${c.hp} ATK${c.attack} DEF${c.defense} NAV${c.navigation} [${c.ability.name}] ${inventory}`
      }).join('\n')
  }

  return { messages, sending, sendMessage, sendChat, sendAction, sendGmMessage, diceRequest, rollDice, characterStates, startGame, announceEntry }
}
