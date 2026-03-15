import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { characters } from '../data/characters'

// Genera un id único por pestaña, persistido en sessionStorage
// sessionStorage se mantiene al refrescar pero no se comparte entre pestañas
function getPlayerId() {
  let id = sessionStorage.getItem('rpg_player_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('rpg_player_id', id)
  }
  return id
}

export function useSession() {
  const [session, setSession] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const playerId = getPlayerId()

  // Comprobar sesión activa al montar
  useEffect(() => {
    checkForActiveSession()
  }, [])

  // Suscribirse a cambios en la sesión (turno, estado) cuando tengamos session.id
  useEffect(() => {
    if (!session?.id) return

    const sub = supabase
      .channel(`session-updates:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` },
        (payload) => setSession(prev => ({ ...prev, ...payload.new }))
      )
      .subscribe()

    return () => sub.unsubscribe()
  }, [session?.id])

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
      setActiveSession(data)
    } else {
      await createNewSession()
    }
    setLoading(false)
  }

  async function continueSession() {
    setSession(activeSession)
    setActiveSession(null)
  }

  async function abandonAndCreate() {
    await supabase
      .from('sessions')
      .update({ status: 'abandoned' })
      .eq('id', activeSession.id)

    setActiveSession(null)
    await createNewSession()
  }

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

    const characterStates = characters.map(c => ({
      session_id: newSession.id,
      character_id: c.id,
      hp_current: c.hp,
      inventory: [],
    }))

    await supabase.from('session_character_state').insert(characterStates)
    setSession(newSession)
  }

  // Reclamar un personaje — la guard de ocupación la hace CharacterSelect vía Presence
  async function claimCharacter(sessionId, characterId) {
    const { error } = await supabase
      .from('session_character_state')
      .update({ claimed_by: playerId, is_active: true })
      .eq('session_id', sessionId)
      .eq('character_id', characterId)

    if (error) console.error('Error reclamando personaje:', error)
    return !error
  }

  // Marcar el personaje de este jugador como inactivo (al salir)
  async function releaseCharacter(sessionId) {
    await supabase
      .from('session_character_state')
      .update({ is_active: false })
      .eq('session_id', sessionId)
      .eq('claimed_by', playerId)
  }

  return { session, activeSession, loading, playerId, continueSession, abandonAndCreate, claimCharacter, releaseCharacter }
}
