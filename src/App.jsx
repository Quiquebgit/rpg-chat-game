import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useTheme } from './hooks/useTheme'
import { useFamilyMode } from './hooks/useFamilyMode'
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

  if (page === 'lobby') {
    return (
      <Lobby
        onSessionSelect={handleSessionSelect}
        continueFromSession={continueFromSession}
        onContinueHandled={() => setContinueFromSession(null)}
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

  return <GameRoom character={character} session={session} onLeave={handleLeaveGame} onSelectCharacter={handleSelectCharacter} onContinueWithCrew={handleContinueWithCrew} familyMode={familyMode} toggleFamilyMode={toggleFamilyMode} />
}

export default App
