import { useState } from 'react'
import { STAT_LABELS } from '../data/constants'

export function CollapsibleAbility({ label, name, description, effects, borderColor, bgColor, labelColor, nameColor }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 pt-3 pb-2 text-left"
      >
        <div className="min-w-0">
          <p className={`text-xs uppercase tracking-widest ${labelColor} mb-0.5`}>{label}</p>
          <p className={`text-sm font-bold ${nameColor} truncate`}>✦ {name}</p>
        </div>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {effects?.map((e, j) => (
            <span key={j} className={`text-xs font-bold ${e.modifier > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {e.modifier > 0 ? '+' : ''}{e.modifier} {STAT_LABELS[e.stat] || e.stat}
            </span>
          ))}
          <span className={`text-base transition-transform duration-200 text-gray-500 inline-block ${open ? '' : '-rotate-90'}`}>▾</span>
        </div>
      </button>
      {open && (
        <p className="text-xs text-gray-400 leading-relaxed px-3 pb-3">{description}</p>
      )}
    </div>
  )
}
