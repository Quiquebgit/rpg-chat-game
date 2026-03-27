import { DICE_EMOJI } from '../data/constants'

export function DiceMessage({ name, content }) {
  // Intentar parsear el formato estándar "🎲 3 + 5 = 8" o "🎲 4 = 4"
  const raw = content.replace('🎲 ', '')
  const eqIdx = raw.lastIndexOf(' = ')
  let dice = null
  let total = null

  if (eqIdx !== -1) {
    const diceStr = raw.slice(0, eqIdx)
    const parsedDice = diceStr.split(' + ').map(Number)
    const parsedTotal = Number(raw.slice(eqIdx + 3))
    if (!isNaN(parsedTotal) && parsedDice.every(d => !isNaN(d) && d > 0)) {
      dice = parsedDice
      total = parsedTotal
    }
  }

  // Formato no estándar (iniciativa, etc.) — tarjeta simplificada
  if (!dice) {
    return (
      <div className="flex flex-col items-center gap-2 w-full px-4">
        <span className="text-xs uppercase tracking-widest text-amber-500/50">{name} · Tirada</span>
        <div className="bg-gray-900 border border-amber-400/30 rounded-2xl px-8 py-4 flex items-center gap-3">
          <span className="text-3xl">🎲</span>
          <span className="text-lg font-bold text-amber-400">{raw}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full px-4">
      <span className="text-xs uppercase tracking-widest text-amber-500/50">{name} · Tirada de dados</span>
      <div className="bg-gray-900 border border-amber-400/30 rounded-2xl px-10 py-6 flex flex-col items-center gap-5 w-fit">
        {/* Dados con emoji de cara */}
        <div className="flex gap-6 items-center">
          {dice.map((val, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-6xl leading-none" style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.4))' }}>
                {DICE_EMOJI[val]}
              </span>
              <span className="text-xs font-bold text-amber-400/60">{val}</span>
            </div>
          ))}
          {dice.length > 1 && (
            <span className="text-2xl text-gray-600 font-light mb-4">=</span>
          )}
        </div>
        {/* Total */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-gray-600">Total</span>
          <span className="text-6xl font-black text-amber-400 leading-none">{total}</span>
        </div>
      </div>
    </div>
  )
}
