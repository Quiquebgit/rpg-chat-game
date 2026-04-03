export function PreGameScreen({ presentedCharacters, onStart, sending }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-widest text-gold-dim/60">La tripulación se reúne</p>
        <h2 className="text-2xl font-bold text-gold-bright">La aventura os espera</h2>
        <p className="text-sm text-ink-3 mt-1">Nadie ha zarpado todavía. ¿Listos para partir?</p>
      </div>

      {presentedCharacters.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <p className="text-xs uppercase tracking-widest text-ink-3 text-center mb-1">En la sala</p>
          {presentedCharacters.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-panel border border-stroke rounded-lg px-4 py-2.5">
              <span className="text-exploration-light text-xs">●</span>
              <div>
                <p className="text-sm font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-ink-3">{c.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onStart}
        disabled={sending || presentedCharacters.length === 0}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xl bg-gold text-canvas hover:bg-gold-bright disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-lg shadow-gold/20"
      >
        <span className="text-3xl">⚓</span>
        ¡Zarpar!
      </button>
    </div>
  )
}
