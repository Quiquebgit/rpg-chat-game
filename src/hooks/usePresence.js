import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Gestiona Supabase Presence para detectar quién está conectado en tiempo real.
// Además de la presencia, rastrea quién es participante activo (vs espectador).
// Si se pasa character, registra presencia activa.
// Si no, solo observa (útil en CharacterSelect).
export function usePresence(session, character = null) {
  const [presentIds, setPresentIds] = useState([])
  const [participantIds, setParticipantIds] = useState([])
  const channelRef = useRef(null)

  // Persistir estado de participante en sessionStorage para sobrevivir navegación entre páginas
  const storageKey = session?.id && character?.id ? `participant_${session.id}_${character.id}` : null
  const isParticipantRef = useRef(storageKey ? sessionStorage.getItem(storageKey) === 'true' : false)
  const [isParticipant, setIsParticipant] = useState(isParticipantRef.current)

  useEffect(() => {
    if (!session?.id) return

    const channelConfig = character?.id
      ? { config: { presence: { key: character.id } } }
      : {}

    const channel = supabase.channel(`presence:${session.id}`, channelConfig)
    channelRef.current = channel

    function syncState() {
      const state = channel.presenceState()
      const ids = Object.keys(state)
      setPresentIds(ids)
      const pIds = ids.filter(id => state[id]?.some(p => p.isParticipant))
      setParticipantIds(pIds)
    }

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, async ({ key }) => {
        syncState()
        // Cualquier cliente que detecte la desconexión actualiza is_active en la BD
        await supabase
          .from('session_character_state')
          .update({ is_active: false })
          .eq('session_id', session.id)
          .eq('character_id', key)
      })
      // Broadcast que emite el cliente que inicia la partida para marcar a todos los presentes
      .on('broadcast', { event: 'GAME_STARTED' }, ({ payload }) => {
        if (character?.id && payload.participantIds?.includes(character.id)) {
          isParticipantRef.current = true
          setIsParticipant(true)
          if (storageKey) sessionStorage.setItem(storageKey, 'true')
          channel.track({ character_id: character.id, isParticipant: true })
        }
      })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && character?.id) {
        // Al reconectar, restaurar el estado de participante previo (si existía)
        await channel.track({ character_id: character.id, isParticipant: isParticipantRef.current })
        // Marcar como activo en BD — puede haberse desactivado por desconexión temporal
        await supabase
          .from('session_character_state')
          .update({ is_active: true })
          .eq('session_id', session.id)
          .eq('character_id', character.id)
      }
    })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [session?.id, character?.id])

  // Emite un broadcast para que todos los presentes se marquen como participantes
  function broadcastGameStart(ids) {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'GAME_STARTED',
      payload: { participantIds: ids },
    })
  }

  // Marca al personaje actual como participante y actualiza su presencia
  function markAsParticipant() {
    if (!character?.id || !channelRef.current) return
    isParticipantRef.current = true
    setIsParticipant(true)
    if (storageKey) sessionStorage.setItem(storageKey, 'true')
    channelRef.current.track({ character_id: character.id, isParticipant: true })
  }

  return { presentIds, participantIds, isParticipant, broadcastGameStart, markAsParticipant }
}
