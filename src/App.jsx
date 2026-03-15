import { useState } from 'react'
import { useSession } from './hooks/useSession'
import CharacterSelect from './pages/CharacterSelect'
import GameRoom from './pages/GameRoom'
import SessionModal from './components/SessionModal'

function App() {
  const [character, setCharacter] = useState(null)
  const { session, activeSession, loading, playerId, continueSession, abandonAndCreate, claimCharacter } = useSession()

  async function handleCharacterConfirm(selectedCharacter) {
    if (!session) return
    const ok = await claimCharacter(session.id, selectedCharacter.id)
    if (ok) setCharacter(selectedCharacter)
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-950 text-white items-center justify-center">
        <p className="text-amber-400 animate-pulse">Preparando la aventura…</p>
      </div>
    )
  }

  if (!character) {
    return (
      <>
        {activeSession && (
          <SessionModal onContinue={continueSession} onAbandon={abandonAndCreate} />
        )}
        <CharacterSelect
          session={session}
          playerId={playerId}
          onConfirm={handleCharacterConfirm}
        />
      </>
    )
  }

  return <GameRoom character={character} session={session} />
}

export default App
