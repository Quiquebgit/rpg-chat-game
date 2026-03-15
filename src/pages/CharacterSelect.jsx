import { useState } from 'react'
import { characters } from '../data/characters'
import CharacterCard from '../components/CharacterCard'

// Pantalla de selección de personaje
function CharacterSelect({ onConfirm }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 py-10">
      {/* Cabecera */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-amber-300 tracking-wide">⚓ Elige tu personaje</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Selecciona a quién encarnarás en esta aventura. Cada elección importa.
        </p>
      </div>

      {/* Grid de cartas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={selected?.id === character.id}
            onSelect={setSelected}
          />
        ))}
      </div>

      {/* Botón de confirmar */}
      <div className="text-center mt-10">
        <button
          onClick={() => selected && onConfirm(selected)}
          disabled={!selected}
          className={`
            px-8 py-3 rounded-xl font-bold text-lg tracking-wide transition-all duration-200
            ${selected
              ? 'bg-amber-400 text-gray-900 hover:bg-amber-300 shadow-lg shadow-amber-400/30'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          {selected ? `Zarpar como ${selected.name}` : 'Selecciona un personaje'}
        </button>
      </div>
    </div>
  )
}

export default CharacterSelect
