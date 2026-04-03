import { useState, useEffect } from 'react'
import { DICE_EMOJI, DEGREE_LABELS } from '../data/constants'

const DEGREE_STYLES = {
  critical_success: { color: 'text-degree-crit-success', border: 'border-degree-crit-success/50', glow: 'var(--degree-crit-success)' },
  success:          { color: 'text-degree-success',       border: 'border-degree-success/40',       glow: 'var(--degree-success)' },
  failure:          { color: 'text-degree-failure',       border: 'border-degree-failure/40',       glow: 'var(--degree-failure)' },
  critical_failure: { color: 'text-degree-crit-failure',  border: 'border-degree-crit-failure/50',  glow: 'var(--degree-crit-failure)' },
}

const STAT_LABELS = { attack: 'ATK', defense: 'DEF', navigation: 'NAV', ability: 'HAB' }

export function DiceMessage({ name, content, familyMode }) {
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
  const borderClass = degreeStyle ? degreeStyle.border : 'border-gold/30'
  // Glow usando color-mix para aplicar opacidad sobre la variable CSS
  const glowColor = degreeStyle
    ? `color-mix(in srgb, ${degreeStyle.glow} 35%, transparent)`
    : 'color-mix(in srgb, var(--accent-gold) 20%, transparent)'

  // Formato no estándar (iniciativa, etc.) — tarjeta simplificada
  if (!dice) {
    return (
      <div className="flex flex-col items-center gap-2 w-full px-4">
        <span className="text-xs uppercase tracking-widest text-gold-dim/50">{name} · Tirada</span>
        <div className="bg-panel border border-gold/30 rounded-2xl px-8 py-4 flex items-center gap-3">
          <span className="text-3xl">🎲</span>
          <span className="text-lg font-bold text-gold">{raw}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full px-4">
      <span className="text-xs uppercase tracking-widest text-gold-dim/50">{name} · Tirada de dados</span>
      <div
        className={`bg-panel border ${borderClass} rounded-2xl px-10 py-6 flex flex-col items-center gap-4 w-fit`}
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
              <span className="text-xs font-bold text-gold/60">{val}</span>
            </div>
          ))}
          {dice.length > 1 && (
            <span className="text-2xl text-ink-3 font-light mb-4">=</span>
          )}
        </div>

        {/* Total — aparece con scale-in tras la animación del dado */}
        <div
          className="flex flex-col items-center gap-1"
          style={{ animation: revealed ? 'scale-in 0.3s ease-out' : 'none', opacity: revealed ? 1 : 0 }}
        >
          <span className="text-xs uppercase tracking-widest text-ink-3">Total</span>
          <span className={`text-6xl font-black leading-none ${degreeStyle ? degreeStyle.color : 'text-gold'}`}>
            {total}
          </span>
        </div>

        {/* Info de skill_check: DC, stat y grado */}
        {dc && revealed && !familyMode && (
          <div className="flex flex-col items-center gap-1.5 border-t border-stroke pt-3 w-full"
            style={{ animation: 'scale-in 0.25s ease-out' }}
          >
            <div className="flex items-center gap-3 text-xs text-ink-3">
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
        {/* Modo familia: indicador simple pasa/falla */}
        {dc && revealed && familyMode && (
          <div className="border-t border-stroke pt-3 w-full text-center" style={{ animation: 'scale-in 0.25s ease-out' }}>
            {degree === 'critical_success' || degree === 'success' ? (
              <span className="text-lg font-black text-degree-success">Acierto</span>
            ) : (
              <span className="text-lg font-black text-degree-failure">Fallo</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
