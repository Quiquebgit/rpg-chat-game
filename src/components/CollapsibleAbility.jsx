import { useState } from 'react'

export function CollapsibleAbility({ label, name, description, borderColor, bgColor, labelColor, nameColor }) {
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
        <span className={`text-base ml-2 shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'} text-gray-500`}>▾</span>
      </button>
      {open && (
        <p className="text-xs text-gray-400 leading-relaxed px-3 pb-3">{description}</p>
      )}
    </div>
  )
}
