import { useState } from 'react'

const EMOJI_OPTIONS = ['\u2694\uFE0F', '\uD83D\uDE02', '\uD83D\uDE31', '\uD83D\uDD25', '\uD83D\uDC80', '\u2764\uFE0F']

// Barra de reacciones emoji debajo de un mensaje.
// Muestra las reacciones existentes como pills y un bot\u00f3n "+" para a\u00f1adir.
export function ReactionBar({ reactions = [], onReact }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5">
      {/* Reacciones existentes */}
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => onReact(r.emoji)}
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

      {/* Bot\u00f3n para a\u00f1adir reacci\u00f3n */}
      <div className="relative">
        <button
          onClick={() => setPickerOpen(v => !v)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-raised border border-stroke text-ink-off hover:bg-float hover:text-ink-3 transition-all text-xs"
          title="Reaccionar"
        >
          +
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-lg bg-float border border-stroke shadow-lg z-30">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReact(emoji); setPickerOpen(false) }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-raised transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
