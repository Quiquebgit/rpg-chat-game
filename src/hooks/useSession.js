import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { characters } from '../data/characters'

// Gestiona el ciclo de vida de la sesión: detectar activa, crear nueva, abandonar
export function useSession() {
  const [session, setSession] = useState(null)
  const [activeSession, setActiveSession] = useState(null) // sesión activa encontrada al entrar
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkForActiveSession()
  }, [])

  async function checkForActiveSession() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) console.error('Error comprobando sesión activa:', error)

    if (data) {
      setActiveSession(data) // hay sesión activa → mostrar modal
    } else {
      await createNewSession() // sin sesión activa → crear directamente
    }
    setLoading(false)
  }

  // Continuar con la sesión activa existente
  async function continueSession() {
    setSession(activeSession)
    setActiveSession(null)
  }

  // Abandonar la sesión activa y crear una nueva
  async function abandonAndCreate() {
    await supabase
      .from('sessions')
      .update({ status: 'abandoned' })
      .eq('id', activeSession.id)

    setActiveSession(null)
    await createNewSession()
  }

  // Crear sesión nueva con todos los personajes inicializados
  async function createNewSession() {
    const turnOrder = characters.map(c => c.id)

    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        status: 'active',
        turn_order: turnOrder,
        current_turn_character_id: turnOrder[0],
      })
      .select()
      .single()

    if (error) {
      console.error('Error creando sesión:', error)
      return
    }

    // Inicializar el estado de cada personaje en la sesión
    const characterStates = characters.map(c => ({
      session_id: newSession.id,
      character_id: c.id,
      hp_current: c.hp,
      inventory: [],
    }))

    const { error: stateError } = await supabase
      .from('session_character_state')
      .insert(characterStates)

    if (stateError) console.error('Error inicializando personajes:', stateError)

    setSession(newSession)
  }

  return { session, activeSession, loading, continueSession, abandonAndCreate }
}
