import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { groq } from '../lib/groq'
import { NARRATOR_SYSTEM_PROMPT } from '../lib/narrator'
import { characters as allCharacters } from '../data/characters'

// Máximo de mensajes recientes que se pasan al narrador como contexto
const NARRATOR_CONTEXT_MESSAGES = 20

export function useMessages(session, activeCharacter) {
  const [messages, setMessages] = useState([])
  const [characterStates, setCharacterStates] = useState([])
  const [sending, setSending] = useState(false)
  const subscriptionRef = useRef(null)

  useEffect(() => {
    if (!session) return

    loadMessages()
    loadCharacterStates()
    subscribeToMessages()

    return () => {
      subscriptionRef.current?.unsubscribe()
    }
  }, [session?.id])

  async function loadMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    if (error) console.error('Error cargando mensajes:', error)
    else setMessages(data || [])
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
            // Evitar duplicados si el mensaje ya fue añadido optimistamente
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()
  }

  // Enviar mensaje de jugador y obtener respuesta del narrador
  async function sendMessage(content) {
    if (!content.trim() || sending) return
    setSending(true)

    // Guardar mensaje del jugador
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

    // Llamar al narrador con el contexto actualizado
    await callNarrator(content.trim())
    setSending(false)
  }

  async function callNarrator(lastPlayerMessage) {
    // Construir contexto de personajes para el narrador
    const characterContext = buildCharacterContext()

    // Historial reciente para el narrador
    const recentMessages = messages.slice(-NARRATOR_CONTEXT_MESSAGES)
    const chatHistory = recentMessages.map(m => {
      const characterName = m.character_id === 'narrator'
        ? 'Narrador'
        : allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${characterName}: ${m.content}`
    }).join('\n')

    // Personaje activo (a quién le toca)
    const currentCharacterName = allCharacters.find(c => c.id === session.current_turn_character_id)?.name
      || activeCharacter.name

    const userPrompt = `
## Estado actual de los personajes
${characterContext}

## Historial reciente
${chatHistory}
${activeCharacter.name}: ${lastPlayerMessage}

## Turno actual
Le toca actuar a: ${currentCharacterName}

Narra la respuesta a la acción del jugador y, si corresponde, interpela al siguiente personaje.`.trim()

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: NARRATOR_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.85,
      })

      const narratorContent = completion.choices[0]?.message?.content
      if (!narratorContent) return

      // Guardar respuesta del narrador
      await supabase.from('messages').insert({
        session_id: session.id,
        character_id: 'narrator',
        content: narratorContent,
        type: 'narrator',
      })
    } catch (err) {
      console.error('Error llamando al narrador:', err)
    }
  }

  // Construir resumen de estado de personajes para el narrador
  function buildCharacterContext() {
    return allCharacters.map(c => {
      const state = characterStates.find(s => s.character_id === c.id)
      const hp = state ? state.hp_current : c.hp
      const inventory = state?.inventory?.length
        ? state.inventory.map(i => i.name).join(', ')
        : 'sin objetos'
      return `- ${c.name} (${c.role}): Vida ${hp}/${c.hp} | Ataque ${c.attack} | Defensa ${c.defense} | Navegación ${c.navigation} | Habilidad: ${c.ability.name} | Inventario: ${inventory}`
    }).join('\n')
  }

  return { messages, sending, sendMessage }
}
