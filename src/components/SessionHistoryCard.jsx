import { useState } from 'react'

const DEGREE_COLORS = {
  critical_success: 'text-degree-crit-success',
  success: 'text-degree-success',
}

// Tarjeta de sesión terminada para el historial del Lobby.
// Muestra título, fecha, MVP, stats resumidos. Expandible para ver highlights y tiradas.
export function SessionHistoryCard({ session, storyTitle }) {
  const [expanded, setExpanded] = useState(false)
  const recap = session.session_recap
  const date = session.created_at
    ? new Date(session.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  return (
    <div
      className="w-full rounded-xl border border-stroke bg-panel px-5 py-4 transition-all hover:border-gold/30 cursor-pointer"
      onClick={() => setExpanded(v => !v)}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-ink truncate">
            {storyTitle || 'Aventura sin título'}
          </h4>
          <p className="text-xs text-ink-off mt-0.5">{date}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {recap?.mvp_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/20 text-xs font-semibold text-gold-bright">
              🏆 {recap.mvp_name}
            </span>
          )}
          <span className="text-ink-off text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Stats rápidos */}
      {recap && (
        <div className="flex gap-4 mt-2 text-xs text-ink-3">
          {recap.duration_minutes > 0 && <span>⏱ {recap.duration_minutes} min</span>}
          <span>💬 {recap.total_messages} msgs</span>
          {recap.deaths?.length > 0 && <span className="text-combat-light">☠️ {recap.deaths.length}</span>}
        </div>
      )}

      {/* Detalle expandido */}
      {expanded && recap && (
        <div className="mt-4 pt-3 border-t border-stroke flex flex-col gap-3">
          {/* Highlights */}
          {recap.highlights?.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs uppercase tracking-widest text-ink-off">Momentos épicos</p>
              {recap.highlights.map((h, i) => (
                <p key={i} className="text-xs text-ink-2 italic leading-relaxed pl-3 border-l-2 border-gold/20">
                  {h}
                </p>
              ))}
            </div>
          )}

          {/* Mejores tiradas */}
          {recap.best_rolls?.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-widest text-ink-off">Mejores tiradas</p>
              {recap.best_rolls.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span>🎲</span>
                  <span className="font-semibold text-ink">{r.character}</span>
                  <span className="text-gold-bright font-black">{r.total}</span>
                  {r.degree && DEGREE_COLORS[r.degree] && (
                    <span className={`font-semibold ${DEGREE_COLORS[r.degree]}`}>
                      {r.degree === 'critical_success' ? 'Crítico' : 'Éxito'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Stats por personaje */}
          {Object.keys(recap.stats || {}).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(recap.stats).map(([id, s]) => (
                <div key={id} className="rounded-lg bg-raised/50 px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    🎲{s.rolls_made} ✨{s.xp_earned}XP 💰{s.money_earned}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sin recap */}
      {expanded && !recap && (
        <p className="mt-3 pt-3 border-t border-stroke text-xs text-ink-off italic">
          Sin datos de resumen para esta partida.
        </p>
      )}
    </div>
  )
}
