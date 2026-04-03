// Carta de personaje para la pantalla de selección

const STAT_CONFIG = [
  { key: 'attack',     icon: '⚔️', label: 'Ataque',     color: 'bg-stat-attack' },
  { key: 'defense',    icon: '🛡️', label: 'Defensa',    color: 'bg-stat-defense' },
  { key: 'navigation', icon: '⚓', label: 'Navegación', color: 'bg-stat-navigation' },
  { key: 'dexterity',  icon: '🎯', label: 'Destreza',   color: 'bg-stat-dexterity' },
  { key: 'charisma',   icon: '💬', label: 'Carisma',    color: 'bg-stat-charisma' },
]

const MAX_STAT = 6

function CharacterCard({ character, selected, onSelect }) {
  const { name, role, combatStyle, hp, ability } = character

  return (
    <div
      onClick={() => onSelect(character)}
      className={`
        cursor-pointer rounded-xl border-2 p-5 transition-all duration-200
        bg-panel hover:bg-raised/80
        ${selected
          ? 'border-gold shadow-xl shadow-gold/25 scale-[1.03] ring-1 ring-gold/40'
          : 'border-stroke-3 hover:border-gold-dim/50 hover:scale-[1.01]'
        }
      `}
    >
      {/* Cabecera */}
      <div className="mb-1">
        <h2
          className="text-xl font-bold text-gold-bright truncate"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {name}
        </h2>
        <p className="text-xs text-ink-2 uppercase tracking-widest">{role}</p>
      </div>

      {/* Estilo de combate */}
      <p className="text-xs text-ink-off italic mb-3">{combatStyle}</p>

      {/* HP */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-ink-3 w-16 shrink-0">❤️ Vida</span>
        <div className="flex-1 bg-raised rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-stat-attack rounded-full"
            style={{ width: `${Math.min(100, (hp / 10) * 100)}%` }}
          />
        </div>
        <span className="text-xs font-bold text-combat-light w-4 text-right">{hp}</span>
      </div>

      {/* Stats con barras */}
      <div className="flex flex-col gap-1.5 mb-4">
        {STAT_CONFIG.map(({ key, icon, label, color }) => {
          const val = character[key] ?? 0
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-ink-3 w-16 shrink-0">{icon} {label}</span>
              <div className="flex-1 bg-raised rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${Math.min(100, (val / MAX_STAT) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-ink-2 w-4 text-right">{val}</span>
            </div>
          )
        })}
      </div>

      {/* Habilidad especial */}
      <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5">
        <p className="text-xs uppercase tracking-widest text-gold-dim/60 mb-0.5">Habilidad</p>
        <p className="text-sm font-bold text-gold-bright">✦ {ability.name}</p>
        <p className="text-xs text-ink-3 leading-relaxed mt-0.5">{ability.description}</p>
      </div>

      {selected && (
        <p className="text-center text-xs font-bold text-gold mt-3 tracking-widest uppercase">
          ✓ Seleccionado
        </p>
      )}
    </div>
  )
}

export default CharacterCard
