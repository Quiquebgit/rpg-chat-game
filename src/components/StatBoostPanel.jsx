import { useState } from 'react'

// Panel de activación de habilidad stat_boost (Liderazgo de Darro)
export function StatBoostPanel({ ability, allies, onActivate }) {
  const [open, setOpen] = useState(false)
  const value = ability.effect?.value ?? 2
  const stat = ability.effect?.stat ?? 'attack'

  if (!allies.length) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-1.5 rounded-lg text-xs font-semibold border border-amber-400/30 bg-amber-400/5 text-amber-300 hover:bg-amber-400/10 transition-colors"
      >
        ⚡ {ability.name} — dar +{value} {stat === 'attack' ? 'ATK' : 'DEF'} a un aliado
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 flex flex-col gap-2">
      <p className="text-xs text-amber-400/80 text-center">⚡ {ability.name}: elige a quién ayudas</p>
      <div className="flex gap-1.5 flex-wrap justify-center">
        {allies.map(ally => (
          <button
            key={ally.id}
            onClick={() => { onActivate(ally); setOpen(false) }}
            className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-gray-900 hover:bg-amber-300 transition-colors"
          >
            {ally.name}
          </button>
        ))}
      </div>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
        Cancelar
      </button>
    </div>
  )
}
