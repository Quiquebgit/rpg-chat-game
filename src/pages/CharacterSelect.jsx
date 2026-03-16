import { useState, useEffect } from 'react'
import { characters } from '../data/characters'
import { supabase } from '../lib/supabase'
import CharacterCard from '../components/CharacterCard'

function CharacterSelect({ session, playerId, onConfirm, onBack }) {
  const [selected, setSelected] = useState(null)
  // Mapa de characterId → { claimedBy, isActive } — fuente de verdad: BD vía Realtime
  const [claimedBy, setClaimedBy] = useState({})

  // Cargar y suscribirse a cambios en session_character_state
  useEffect(() => {
    if (!session) return

    loadClaimedCharacters()

    const sub = supabase
      .channel(`claimed:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_character_state', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setClaimedBy(prev => ({
            ...prev,
            [payload.new.character_id]: { claimedBy: payload.new.claimed_by, isActive: payload.new.is_active },
          }))
        }
      )
      .subscribe()

    return () => sub.unsubscribe()
  }, [session?.id])

  async function loadClaimedCharacters() {
    const { data, error } = await supabase
      .from('session_character_state')
      .select('character_id, claimed_by, is_active')
      .eq('session_id', session.id)

    if (error) console.error('Error cargando personajes reclamados:', error)
    else {
      const map = {}
      data.forEach(row => { map[row.character_id] = { claimedBy: row.claimed_by, isActive: row.is_active } })
      setClaimedBy(map)
    }
  }

  function handleSelect(character) {
    const state = claimedBy[character.id]
    const takenByOther = state?.isActive && state?.claimedBy !== playerId
    if (!takenByOther) setSelected(character)
  }

  function getCardStatus(character) {
    const state = claimedBy[character.id]
    if (!state?.isActive) return 'free'
    if (state.claimedBy === playerId) return 'mine'
    return 'taken'
  }

  async function forceRelease(characterId) {
    await supabase
      .from('session_character_state')
      .update({ is_active: false, claimed_by: null })
      .eq('session_id', session.id)
      .eq('character_id', characterId)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-6 pt-10 pb-28">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-amber-300 tracking-wide">⚓ Elige tu personaje</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Selecciona a quién encarnarás en esta aventura. Cada elección importa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {characters.map((character) => {
          const status = getCardStatus(character)
          return (
            <div key={character.id} className="relative">
              {/* Overlay para personajes ocupados por otro jugador */}
              {status === 'taken' && (
                <div className="absolute inset-0 z-10 rounded-xl bg-gray-950/70 flex flex-col items-center justify-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">En juego</p>
                  <button
                    onClick={() => forceRelease(character.id)}
                    className="text-xs text-red-800 hover:text-red-500 underline underline-offset-2 transition-colors"
                  >
                    Liberar
                  </button>
                </div>
              )}
              <CharacterCard
                character={character}
                selected={selected?.id === character.id}
                onSelect={status !== 'taken' ? handleSelect : () => {}}
                disabled={status === 'taken'}
              />
            </div>
          )
        })}
      </div>

      {/* Barra de acción fija en la parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950/90 backdrop-blur border-t border-gray-800 px-6 py-4 flex items-center justify-center gap-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
        >
          ← Volver
        </button>
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
