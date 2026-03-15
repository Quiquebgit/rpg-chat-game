// Carta de personaje para la pantalla de selección
function CharacterCard({ character, selected, onSelect }) {
  const { name, role, combatStyle, hp, attack, defense, navigation, ability } = character

  return (
    <div
      onClick={() => onSelect(character)}
      className={`
        cursor-pointer rounded-xl border-2 p-5 transition-all duration-200
        bg-gray-900 hover:bg-gray-800
        ${selected
          ? 'border-amber-400 shadow-lg shadow-amber-400/30 scale-105'
          : 'border-gray-700 hover:border-amber-600'
        }
      `}
    >
      {/* Cabecera */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-amber-300">{name}</h2>
        <p className="text-sm text-gray-400 uppercase tracking-widest">{role}</p>
      </div>

      {/* Estilo de combate */}
      <p className="text-xs text-gray-500 italic mb-4">{combatStyle}</p>

      {/* Stats */}
      <div className="flex flex-col gap-2 mb-4">
        <Stat label="Vida" value={hp} icon="❤️" />
        <Stat label="Ataque" value={attack} icon="⚔️" />
        <Stat label="Defensa" value={defense} icon="🛡️" />
        <Stat label="Navegación" value={navigation} icon="🧭" />
      </div>

      {/* Habilidad especial */}
      <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-4 mt-2">
        <p className="text-xs uppercase tracking-widest text-amber-500/70 mb-1">Habilidad especial</p>
        <p className="text-sm font-bold text-amber-300 mb-1">✦ {ability.name}</p>
        <p className="text-xs text-gray-400 leading-relaxed">{ability.description}</p>
      </div>

      {selected && (
        <p className="text-center text-xs font-bold text-amber-400 mt-3 tracking-widest uppercase">
          Seleccionado
        </p>
      )}
    </div>
  )
}

// Stat individual — puntos reales + número, sin max fijo
function Stat({ label, value, icon }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs text-gray-500">{icon} {label}</p>
        <span className="text-xs font-bold text-amber-400">{value}</span>
      </div>
      <div className="flex gap-1 items-center">
        {Array.from({ length: value }).map((_, i) => (
          <div key={i} className="h-4 w-3 bg-amber-400 shrink-0 rotate-45" style={{ clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)' }} />
        ))}
      </div>
    </div>
  )
}

export default CharacterCard
