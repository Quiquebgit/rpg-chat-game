// Pills horizontales con sugerencias de espectadores para el jugador activo.
export function SuggestionPills({ suggestions, onDismiss }) {
  if (!suggestions?.length) return null

  return (
    <div className="flex gap-1.5 flex-wrap mb-2">
      <span className="text-xs text-ink-off uppercase tracking-widest self-center mr-1">Sugerencias:</span>
      {suggestions.map(s => (
        <div
          key={s.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-raised border border-stroke text-xs"
        >
          <span className="text-ink-3 font-semibold">{s.characterName}:</span>
          <span className="text-ink-2">{s.suggestion}</span>
          <button
            onClick={() => onDismiss(s.id)}
            className="text-ink-off hover:text-ink-3 transition-colors ml-0.5"
            title="Descartar"
          >
            \u00D7
          </button>
        </div>
      ))}
    </div>
  )
}
