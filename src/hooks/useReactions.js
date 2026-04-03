import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Gestiona reacciones emoji en mensajes del narrador.
// Carga, suscribe en tiempo real, y permite toggle de reacciones.
// playerId es opcional — si no se pasa, se lee de sessionStorage.
export function useReactions(sessionId, playerId) {
  if (!playerId) playerId = sessionStorage.getItem('rpg_player_id') || 'unknown'
  // Map<messageId, Array<{ emoji, count, hasReacted }>>
  const [reactionsByMessage, setReactionsByMessage] = useState({})
  const rawRef = useRef([]) // Array crudo de { message_id, player_id, emoji }

  // Recalcula el mapa agrupado a partir de rawRef
  function rebuild() {
    const map = {}
    for (const r of rawRef.current) {
      if (!map[r.message_id]) map[r.message_id] = {}
      if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = { emoji: r.emoji, count: 0, hasReacted: false }
      map[r.message_id][r.emoji].count++
      if (r.player_id === playerId) map[r.message_id][r.emoji].hasReacted = true
    }
    // Convertir a arrays
    const result = {}
    for (const [msgId, emojis] of Object.entries(map)) {
      result[msgId] = Object.values(emojis)
    }
    setReactionsByMessage(result)
  }

  // Cargar reacciones existentes para todos los mensajes de la sesión
  useEffect(() => {
    if (!sessionId) return

    async function load() {
      const { data } = await supabase
        .from('message_reactions')
        .select('id, message_id, player_id, emoji')
        .eq('message_id.session_id', sessionId)

      // Si el join no funciona (sin relación directa), cargar por mensajes de la sesión
      if (!data) {
        // Fallback: obtener IDs de mensajes de la sesión y luego sus reacciones
        const { data: msgs } = await supabase
          .from('messages')
          .select('id')
          .eq('session_id', sessionId)
        if (msgs?.length) {
          const msgIds = msgs.map(m => m.id)
          const { data: reactions } = await supabase
            .from('message_reactions')
            .select('id, message_id, player_id, emoji')
            .in('message_id', msgIds)
          rawRef.current = reactions || []
        }
      } else {
        rawRef.current = data
      }
      rebuild()
    }

    load()

    // Suscripción en tiempo real a cambios en message_reactions
    const channel = supabase
      .channel(`reactions:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          rawRef.current = [...rawRef.current, payload.new]
          rebuild()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          rawRef.current = rawRef.current.filter(r => r.id !== payload.old.id)
          rebuild()
        }
      )
      .subscribe()

    return () => channel.unsubscribe()
  }, [sessionId, playerId])

  // Toggle: insertar si no existe, borrar si ya existe
  const toggleReaction = useCallback(async (messageId, emoji) => {
    const existing = rawRef.current.find(
      r => r.message_id === messageId && r.player_id === playerId && r.emoji === emoji
    )

    if (existing) {
      // Optimistic delete
      rawRef.current = rawRef.current.filter(r => r.id !== existing.id)
      rebuild()
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      // Optimistic insert
      const tempId = crypto.randomUUID()
      const newReaction = { id: tempId, message_id: messageId, player_id: playerId, emoji }
      rawRef.current = [...rawRef.current, newReaction]
      rebuild()
      const { data } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, player_id: playerId, emoji })
        .select('id')
        .single()
      // Reemplazar el tempId con el real
      if (data) {
        rawRef.current = rawRef.current.map(r => r.id === tempId ? { ...r, id: data.id } : r)
      }
    }
  }, [playerId])

  return { reactionsByMessage, toggleReaction }
}
