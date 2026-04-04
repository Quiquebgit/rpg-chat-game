import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useTheme } from './hooks/useTheme'
import { useFamilyMode } from './hooks/useFamilyMode'
import { initializeStorySession } from './lib/director'
import { characters as allCharacters } from './data/characters'
import { SUPPLIES_CONFIG } from './data/constants'
import Lobby from './pages/Lobby'
import CharacterSelect from './pages/CharacterSelect'
import GameRoom from './pages/GameRoom'

// Id único por pestaña — persiste al refrescar, no se comparte entre pestañas
function getPlayerId() {
  let id = sessionStorage.getItem('rpg_player_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('rpg_player_id', id)
  }
  return id
}

const playerId = getPlayerId()

function App() {
  // Inicializa el tema desde localStorage o preferencia del sistema
  useTheme()
  const { familyMode, toggleFamilyMode } = useFamilyMode()

  const [page, setPage] = useState('lobby')
  const [session, setSession] = useState(null)
  const [character, setCharacter] = useState(null)
  const [continueFromSession, setContinueFromSession] = useState(null)
  const joinHandled = useRef(false)

  // Link de invitación: ?join=<session_id> lleva directo a selección de personaje
  useEffect(() => {
    if (joinHandled.current) return
    const joinId = new URLSearchParams(window.location.search).get('join')
    if (!joinId) return
    joinHandled.current = true
    // Limpiar la URL para evitar re-trigger al refrescar
    window.history.replaceState({}, '', window.location.pathname)

    supabase
      .from('sessions')
      .select('*')
      .eq('id', joinId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setSession(data)
          setPage('select')
        }
      })
  }, [])

  // Suscribirse a cambios de sesión (turno, estado) para mantener GameRoom actualizado
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

  function handleSessionSelect(selectedSession) {
    setSession(selectedSession)
    setPage('select')
  }

  async function handleCharacterConfirm(selectedCharacter) {
    const { error } = await supabase
      .from('session_character_state')
      .update({ claimed_by: playerId, is_active: true })
      .eq('session_id', session.id)
      .eq('character_id', selectedCharacter.id)

    if (!error) {
      // Reactivar la sesión si estaba archivada
      if (session.status !== 'active') {
        await supabase.from('sessions').update({ status: 'active' }).eq('id', session.id)
        setSession(prev => ({ ...prev, status: 'active' }))
      }
      setCharacter(selectedCharacter)
      setPage('game')
    }
  }

  async function releaseCharacter() {
    if (session && character) {
      await supabase
        .from('session_character_state')
        .update({ is_active: false })
        .eq('session_id', session.id)
        .eq('character_id', character.id)
    }
    setCharacter(null)
  }

  async function handleLeaveGame() {
    await releaseCharacter()
    setSession(null)
    setPage('lobby')
  }

  async function handleContinueWithCrew(finishedSession) {
    await releaseCharacter()
    setSession(null)
    setContinueFromSession(finishedSession)
    setPage('lobby')
  }

  async function handleSelectCharacter() {
    await releaseCharacter()
    setPage('select')
  }

  // Continúa inline desde GameRoom sin salir: crea nueva sesión con tripulación heredada
  async function handleContinueInline(finishedSession, story, template) {
    const turnOrder = allCharacters.map(c => c.id)
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        status: 'active',
        turn_order: turnOrder,
        current_turn_character_id: turnOrder[0],
        story_id: story.id,
        difficulty_template_id: template.id,
        current_event_order: 1,
        supplies_days: Math.max(SUPPLIES_CONFIG.MIN_INHERIT, finishedSession.supplies_days ?? SUPPLIES_CONFIG.DEFAULT),
        crew_reputation: finishedSession.crew_reputation ?? 0,
      })
      .select()
      .single()

    if (error) { console.error('[App] Error creando sesión inline:', error); return }

    // Cargar stats heredados de la sesión anterior
    const { data: prevStates } = await supabase
      .from('session_character_state')
      .select('character_id, inventory, money, xp, stat_upgrades, bounty_current, titles, achievement_counters')
      .eq('session_id', finishedSession.id)

    // Crear estados con progresión heredada; reclamar el personaje actual del jugador
    await supabase.from('session_character_state').insert(
      allCharacters.map(c => {
        const prev = (prevStates || []).find(s => s.character_id === c.id)
        const isMe = character && c.id === character.id
        return {
          session_id: newSession.id,
          character_id: c.id,
          hp_current: c.hp,
          inventory: prev?.inventory || [],
          money: prev?.money || 0,
          xp: prev?.xp || 0,
          stat_upgrades: prev?.stat_upgrades || {},
          bounty_current: prev?.bounty_current ?? null,
          titles: prev?.titles || [],
          achievement_counters: prev?.achievement_counters || {},
          ...(isMe ? { claimed_by: playerId, is_active: true } : {}),
        }
      })
    )

    // Liberar personaje de la sesión anterior
    if (character) {
      await supabase
        .from('session_character_state')
        .update({ is_active: false })
        .eq('session_id', finishedSession.id)
        .eq('character_id', character.id)
    }

    // El Director prepara el primer evento
    await initializeStorySession(newSession.id, story.id, template)

    // Recargar sesión lista y actualizar estado — sin cambiar de página
    const { data: readySession } = await supabase
      .from('sessions').select('*').eq('id', newSession.id).single()

    setSession(readySession || newSession)
    // character se mantiene igual — el jugador sigue con su personaje
  }

  if (page === 'lobby') {
    return (
      <Lobby
        onSessionSelect={handleSessionSelect}
        continueFromSession={continueFromSession}
        onContinueHandled={() => setContinueFromSession(null)}
        onContinueWithCrew={handleContinueWithCrew}
        familyMode={familyMode}
        toggleFamilyMode={toggleFamilyMode}
      />
    )
  }

  if (page === 'select') {
    return (
      <CharacterSelect
        session={session}
        playerId={playerId}
        onConfirm={handleCharacterConfirm}
        onBack={() => setPage('lobby')}
      />
    )
  }

  return <GameRoom character={character} session={session} onLeave={handleLeaveGame} onSelectCharacter={handleSelectCharacter} onContinueWithCrew={handleContinueWithCrew} onContinueInline={handleContinueInline} familyMode={familyMode} toggleFamilyMode={toggleFamilyMode} />
}

export default App
