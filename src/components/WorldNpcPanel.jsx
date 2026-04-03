import { useState } from 'react'
import { MARINA_RANKS, FACTION_STYLES, NPC_STATUS_STYLES } from '../data/constants'

function NpcCard({ npc }) {
  const [expanded, setExpanded] = useState(false)
  const rank = MARINA_RANKS[npc.rank] || MARINA_RANKS.other
  const faction = FACTION_STYLES[npc.faction] || FACTION_STYLES.otro
  const status = NPC_STATUS_STYLES[npc.status] || NPC_STATUS_STYLES.active
  const isDefeated = npc.status === 'defeated'

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 min-w-[170px] max-w-[240px] transition-all cursor-pointer ${faction.bg} ${faction.border} ${isDefeated ? 'opacity-60 grayscale' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Cabecera: icono + nombre + estado */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{rank.icon}</span>
        <span
          className={`text-xs font-bold truncate flex-1 ${isDefeated ? 'line-through text-ink-off' : 'text-gold-bright'}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {npc.name}
        </span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} title={status.label} />
      </div>

      {/* Rango + facción */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
          {rank.label}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${faction.bg} ${faction.border} ${faction.color}`}>
          {faction.label}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-[11px] text-ink-2 mb-1">
        <span>❤️ {npc.hp}</span>
        <span>⚔️ {npc.attack}</span>
        <span>🛡️ {npc.defense}</span>
      </div>

      {/* Bounty */}
      {npc.bounty > 0 && (
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-[10px] text-gold font-bold mb-1">
          💰 {npc.bounty.toLocaleString()} B
        </div>
      )}

      {/* Descripción expandida */}
      {expanded && npc.description && (
        <p className="text-[11px] text-ink-3 mt-1.5 leading-relaxed">
          {npc.description}
        </p>
      )}
    </div>
  )
}

export default function WorldNpcPanel({ npcs }) {
  if (!npcs?.length) return null

  const activeNpcs = npcs.filter(n => n.status !== 'defeated')
  const defeatedNpcs = npcs.filter(n => n.status === 'defeated')

  return (
    <div className="space-y-3">
      {/* NPCs activos */}
      {activeNpcs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {activeNpcs.map(npc => (
            <NpcCard key={npc.id} npc={npc} />
          ))}
        </div>
      )}

      {/* NPCs derrotados (colapsados) */}
      {defeatedNpcs.length > 0 && (
        <details className="group">
          <summary className="text-xs text-ink-3 cursor-pointer hover:text-ink-2 transition-colors">
            💀 Derrotados ({defeatedNpcs.length})
          </summary>
          <div className="flex gap-2 flex-wrap mt-2">
            {defeatedNpcs.map(npc => (
              <NpcCard key={npc.id} npc={npc} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
