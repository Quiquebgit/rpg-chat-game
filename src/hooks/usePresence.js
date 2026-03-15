import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Gestiona Supabase Presence para detectar quién está conectado en tiempo real.
// Si se pasa character, registra presencia activa.
// Si no, solo observa (útil en CharacterSelect).
export function usePresence(session, character = null) {
  const [presentIds, setPresentIds] = useState([])

  useEffect(() => {
    if (!session?.id) return

    // La clave de presencia es el character_id para identificar quién ocupa cada personaje
    const channelConfig = character?.id
      ? { config: { presence: { key: character.id } } }
      : {}

    const channel = supabase.channel(`presence:${session.id}`, channelConfig)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setPresentIds(Object.keys(state))
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setPresentIds(prev => [...new Set([...prev, key])])
      })
      .on('presence', { event: 'leave' }, async ({ key }) => {
        setPresentIds(prev => prev.filter(id => id !== key))
        // Cualquier cliente que detecte la desconexión actualiza is_active en la BD
        await supabase
          .from('session_character_state')
          .update({ is_active: false })
          .eq('session_id', session.id)
          .eq('character_id', key)
      })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && character?.id) {
        await channel.track({ character_id: character.id })
      }
    })

    return () => channel.unsubscribe()
  }, [session?.id, character?.id])

  return { presentIds }
}
