import { useState } from 'react'
import CharacterSelect from './pages/CharacterSelect'
import GameRoom from './pages/GameRoom'

function App() {
  const [selectedCharacter, setSelectedCharacter] = useState(null)

  if (!selectedCharacter) {
    return <CharacterSelect onConfirm={setSelectedCharacter} />
  }

  return <GameRoom character={selectedCharacter} />
}

export default App
