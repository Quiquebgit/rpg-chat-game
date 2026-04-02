import { useState } from 'react'

// Panel de activación de habilidad stat_boost (Liderazgo de Darro)
// Si ability.effect.stat_choices existe, muestra primero selector de stat
export function StatBoostPanel({ ability, allies, onActivate }) {
  const [open, setOpen] = useState(false)
  const [selectedStat, setSelectedStat] = useState(null)
  const value = ability.effect?.value ?? 2
  const statChoices = ability.effect?.stat_choices || null
  const defaultStat = ability.effect?.stat ?? 'attack'

  if (!allies.length) return null

  function handleActivate(ally) {
    const stat = selectedStat || defaultStat
    onActivate(ally, stat)
    setOpen(false)
    setSelectedStat(null)
  }

  function handleCancel() {
    setOpen(false)
    setSelectedStat(null)
  }

  const statLabel = (s) => s === 'attack' ? 'ATK' : 'DEF'
  const activeStat = selectedStat || defaultStat

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-1.5 rounded-lg text-xs font-semibold border border-amber-400/30 bg-amber-400/5 text-amber-300 hover:bg-amber-400/10 transition-colors"
      >
        ⚡ {ability.name} — dar +{value} {statLabel(defaultStat)} a un aliado
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 flex flex-col gap-2">
      {/* Paso 1: elegir stat (solo si hay elección) */}
      {statChoices && !selectedStat && (
        <>
          <p className="text-xs text-amber-400/80 text-center">⚡ {ability.name}: elige qué subir (+{value})</p>
          <div className="flex gap-2 justify-center">
            {statChoices.map(s => (
              <button
                key={s}
                onClick={() => setSelectedStat(s)}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-amber-400/20 border border-amber-400/50 text-amber-300 hover:bg-amber-400 hover:text-gray-900 transition-colors"
              >
                +{value} {statLabel(s)}
              </button>
            ))}
          </div>
          <button onClick={handleCancel} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Cancelar
          </button>
        </>
      )}
      {/* Paso 2 (o único paso): elegir aliado */}
      {(!statChoices || selectedStat) && (
        <>
          <p className="text-xs text-amber-400/80 text-center">
            ⚡ {ability.name}: elige a quién dar +{value} {statLabel(activeStat)}
          </p>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {allies.map(ally => (
              <button
                key={ally.id}
                onClick={() => handleActivate(ally)}
                className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-gray-900 hover:bg-amber-300 transition-colors"
              >
                {ally.name}
              </button>
            ))}
          </div>
          <button onClick={handleCancel} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Cancelar
          </button>
        </>
      )}
    </div>
  )
}

// Panel de activación de habilidad heal (Tratamiento de Vela)
export function HealPanel({ ability, allies, onActivate }) {
  const [open, setOpen] = useState(false)
  const value = ability.effect?.value_combat ?? ability.effect?.value ?? 2

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-1.5 rounded-lg text-xs font-semibold border border-emerald-400/30 bg-emerald-400/5 text-emerald-300 hover:bg-emerald-400/10 transition-colors"
      >
        💚 {ability.name} — curar {value}HP a un aliado
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-2 flex flex-col gap-2">
      <p className="text-xs text-emerald-400/80 text-center">💚 {ability.name}: elige a quién curar (+{value}HP)</p>
      <div className="flex gap-1.5 flex-wrap justify-center">
        {allies.map(ally => (
          <button
            key={ally.id}
            onClick={() => { onActivate(ally); setOpen(false) }}
            className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-400 text-gray-900 hover:bg-emerald-300 transition-colors"
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
