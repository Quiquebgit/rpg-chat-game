import { useState } from 'react'

const EMOJI_OPTIONS = ['⚔️', '😂', '😱', '🔥', '💀', '❤️']

// Pills de reacciones existentes (sin botón añadir).
export function ReactionPills({ reactions, onReact }) {
  if (!reactions?.length) return null
  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={e => { e.stopPropagation(); onReact(r.emoji) }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
            r.hasReacted
              ? 'bg-gold/20 border border-gold/40 text-gold-bright'
              : 'bg-raised border border-stroke text-ink-3 hover:bg-float hover:text-ink-2'
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-semibold">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

// Botón + con picker de emojis, para posicionar en la esquina del mensaje.
export function ReactionAddButton({ onReact }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setPickerOpen(v => !v) }}
        className="flex items-center justify-center w-6 h-6 rounded-full bg-raised border border-stroke text-ink-off hover:bg-float hover:text-ink-3 transition-all text-xs"
        title="Reaccionar"
      >
        +
      </button>
      {pickerOpen && (
        <>
          {/* Overlay para cerrar */}
          <div
            className="fixed inset-0 z-20"
            onClick={e => { e.stopPropagation(); setPickerOpen(false) }}
          />
          <div className="absolute bottom-full right-0 mb-1 flex gap-1 p-1.5 rounded-lg bg-float border border-stroke shadow-lg z-30">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={e => { e.stopPropagation(); onReact(emoji); setPickerOpen(false) }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-raised transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ReactionBar completa: pills + botón añadir en línea. Mantenida por compatibilidad.
export function ReactionBar({ reactions = [], onReact }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5">
      <ReactionPills reactions={reactions} onReact={onReact} />
      <ReactionAddButton onReact={onReact} />
    </div>
  )
}
