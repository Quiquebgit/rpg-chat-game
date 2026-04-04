import { useState } from 'react'

// Input compacto para que los espectadores sugieran acciones al jugador activo.
export function SpectatorSuggestInput({ onSend }) {
  const [text, setText] = useState('')

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 w-full max-w-sm">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Sugiere una acción..."
        maxLength={100}
        className="flex-1 bg-panel border border-stroke rounded-lg px-3 py-1.5 text-xs text-ink placeholder-ink-off focus:outline-none focus:border-gold/40"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-raised border border-stroke text-ink-2 hover:bg-float hover:text-ink disabled:opacity-40 transition-colors"
      >
        Sugerir
      </button>
    </div>
  )
}
