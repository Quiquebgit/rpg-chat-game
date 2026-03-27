export function PreGameScreen({ presentedCharacters, onStart, sending }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-widest text-amber-500/60">La tripulación se reúne</p>
        <h2 className="text-2xl font-bold text-amber-300">La aventura os espera</h2>
        <p className="text-sm text-gray-500 mt-1">Nadie ha zarpado todavía. ¿Listos para partir?</p>
      </div>

      {presentedCharacters.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <p className="text-xs uppercase tracking-widest text-gray-600 text-center mb-1">En la sala</p>
          {presentedCharacters.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
              <span className="text-green-400 text-xs">●</span>
              <div>
                <p className="text-sm font-semibold text-gray-200">{c.name}</p>
                <p className="text-xs text-gray-600">{c.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onStart}
        disabled={sending || presentedCharacters.length === 0}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xl bg-amber-400 text-gray-900 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-400/20"
      >
        <span className="text-3xl">⚓</span>
        ¡Zarpar!
      </button>
    </div>
  )
}
