import { characters as allCharacters } from '../data/characters'

const DEGREE_DISPLAY = {
  critical_success: { label: 'Crítico',     color: 'text-degree-crit-success' },
  success:          { label: 'Éxito',       color: 'text-degree-success' },
  failure:          { label: 'Fallo',       color: 'text-degree-failure' },
  critical_failure: { label: 'Catástrofe',  color: 'text-degree-crit-failure' },
}

// Modal de recap al terminar la aventura.
// Muestra MVP, highlights, mejores tiradas, muertes y stats por personaje.
export function SessionRecapModal({ recap, onContinue, onLeave }) {
  const hasRecap = recap && recap.total_messages > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8">
      <div className="mx-4 max-w-lg w-full rounded-2xl border border-gold/40 bg-canvas p-8 flex flex-col gap-6 shadow-2xl shadow-gold/20">

        {/* Cabecera */}
        <div className="text-center">
          <p className="text-5xl mb-2">⚓</p>
          <h3
            className="text-2xl font-bold text-gold-bright"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            ¡Aventura completada!
          </h3>
        </div>

        {hasRecap ? (
          <>
            {/* MVP */}
            {recap.mvp_name && (
              <div className="text-center rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-gold-dim/70 mb-1">MVP de la aventura</p>
                <p className="text-lg font-bold text-gold-bright">🏆 {recap.mvp_name}</p>
              </div>
            )}

            {/* Highlights */}
            {recap.highlights?.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest text-ink-3">Momentos épicos</p>
                {recap.highlights.map((h, i) => (
                  <p key={i} className="text-sm text-ink-2 italic leading-relaxed pl-3 border-l-2 border-gold/30">
                    {h}
                  </p>
                ))}
              </div>
            )}

            {/* Mejores tiradas */}
            {recap.best_rolls?.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs uppercase tracking-widest text-ink-3">Mejores tiradas</p>
                {recap.best_rolls.map((r, i) => {
                  const deg = DEGREE_DISPLAY[r.degree]
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-lg">🎲</span>
                      <span className="font-semibold text-ink">{r.character}</span>
                      <span className="text-gold-bright font-black">{r.total}</span>
                      {deg && <span className={`text-xs font-semibold ${deg.color}`}>{deg.label}</span>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Muertes */}
            {recap.deaths?.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-widest text-ink-3">Caídos en batalla</p>
                {recap.deaths.map((d, i) => (
                  <p key={i} className="text-sm text-combat-light">☠️ {d.character}</p>
                ))}
              </div>
            )}

            {/* Stats por personaje */}
            {Object.keys(recap.stats || {}).length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs uppercase tracking-widest text-ink-3">Estadísticas</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(recap.stats).map(([id, s]) => (
                    <div key={id} className="rounded-lg bg-panel border border-stroke px-3 py-2">
                      <p className="text-xs font-semibold text-ink mb-1">{s.name}</p>
                      <div className="flex gap-3 text-xs text-ink-3">
                        <span>🎲 {s.rolls_made}</span>
                        <span>✨ {s.xp_earned} XP</span>
                        <span>💰 {s.money_earned}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duración */}
            <p className="text-xs text-ink-off text-center">
              {recap.total_messages} mensajes · {recap.duration_minutes} min
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-2 leading-relaxed text-center">
            La tripulación ha llegado al final de esta historia. ¿Qué hacéis a continuación?
          </p>
        )}

        {/* Botones */}
        <div className="flex flex-col gap-3 pt-2">
          {onContinue && (
            <button
              onClick={onContinue}
              className="w-full py-3 rounded-xl font-bold bg-gold text-canvas hover:bg-gold-bright transition-all"
            >
              ⚔️ Nueva aventura con esta tripulación
            </button>
          )}
          <button
            onClick={onLeave}
            className="w-full py-3 rounded-xl font-semibold border border-stroke text-ink-2 hover:bg-raised/50 transition-all"
          >
            Volver al Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
