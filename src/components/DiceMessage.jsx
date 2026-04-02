import { useState, useEffect } from 'react'
import { DICE_EMOJI, DEGREE_LABELS } from '../data/constants'

const DEGREE_STYLES = {
  critical_success: { color: 'text-yellow-300', border: 'border-yellow-400/50', glow: 'rgba(250,204,21,0.35)' },
  success:          { color: 'text-emerald-300', border: 'border-emerald-400/40', glow: 'rgba(52,211,153,0.2)' },
  failure:          { color: 'text-red-400',     border: 'border-red-500/40',     glow: 'rgba(239,68,68,0.15)' },
  critical_failure: { color: 'text-red-600',     border: 'border-red-700/50',     glow: 'rgba(185,28,28,0.3)' },
}

const STAT_LABELS = { attack: 'ATK', defense: 'DEF', navigation: 'NAV', ability: 'HAB' }

export function DiceMessage({ name, content }) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 600)
    return () => clearTimeout(t)
  }, [])

  const raw = content.replace('🎲 ', '')

  const dotParts = raw.split(' · ')
  const diceAndTotal = dotParts[0]
  const dcTag = dotParts.find(p => p.startsWith('DC:'))
  const dc = dcTag ? Number(dcTag.slice(3)) : null
  const stat = dotParts.find(p => STAT_LABELS[p]) || null
  const degree = dotParts.find(p => DEGREE_STYLES[p]) || null

  const eqIdx = diceAndTotal.lastIndexOf(' = ')
  let dice = null
  let total = null

  if (eqIdx !== -1) {
    const diceStr = diceAndTotal.slice(0, eqIdx).replace(/\s*\([^)]*\)/, '')
    const parsedDice = diceStr.split(' + ').map(Number)
    const parsedTotal = Number(diceAndTotal.slice(eqIdx + 3))
    if (!isNaN(parsedTotal) && parsedDice.every(d => !isNaN(d) && d > 0)) {
      dice = parsedDice
      total = parsedTotal
    }
  }

  const degreeStyle = degree ? DEGREE_STYLES[degree] : null
  const degreeLabel = degree ? DEGREE_LABELS[degree] : null
  const borderClass = degreeStyle ? degreeStyle.border : 'border-amber-400/30'
  const glowColor = degreeStyle ? degreeStyle.glow : 'rgba(251,191,36,0.2)'

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
      <div
        className={`bg-gray-900 border ${borderClass} rounded-2xl px-10 py-6 flex flex-col items-center gap-4 w-fit`}
        style={{ boxShadow: `0 0 24px ${glowColor}` }}
      >
        {/* Dados con animación de lanzamiento */}
        <div className="flex gap-6 items-center">
          {dice.map((val, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className="text-6xl leading-none"
                style={{
                  filter: `drop-shadow(0 0 8px ${glowColor})`,
                  animation: revealed ? 'none' : `dice-roll 0.6s ease-out`,
                }}
              >
                {DICE_EMOJI[val] || '🎲'}
              </span>
              <span className="text-xs font-bold text-amber-400/60">{val}</span>
            </div>
          ))}
          {dice.length > 1 && (
            <span className="text-2xl text-gray-600 font-light mb-4">=</span>
          )}
        </div>

        {/* Total — aparece con scale-in tras la animación del dado */}
        <div
          className="flex flex-col items-center gap-1"
          style={{ animation: revealed ? 'scale-in 0.3s ease-out' : 'none', opacity: revealed ? 1 : 0 }}
        >
          <span className="text-xs uppercase tracking-widest text-gray-600">Total</span>
          <span className={`text-6xl font-black leading-none ${degreeStyle ? degreeStyle.color : 'text-amber-400'}`}>
            {total}
          </span>
        </div>

        {/* Info de skill_check: DC, stat y grado */}
        {dc && revealed && (
          <div className="flex flex-col items-center gap-1.5 border-t border-gray-800 pt-3 w-full"
            style={{ animation: 'scale-in 0.25s ease-out' }}
          >
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {stat && <span>{STAT_LABELS[stat] || stat}</span>}
              <span>vs DC {dc}</span>
            </div>
            {degreeLabel && (
              <span className={degreeLabel.className}>
                {degreeLabel.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
