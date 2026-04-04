// Tarjeta estilo "cartel de se busca" para mostrar el bounty dinámico de un personaje
import { TITLES_CATALOG } from '../data/constants'

export function WantedPosterCard({ character, bountyCurrentOverride, titles = [] }) {
  const displayBounty = bountyCurrentOverride ?? character.bounty ?? 0
  const isRaised = bountyCurrentOverride != null && bountyCurrentOverride > (character.bounty ?? 0)

  const unlockedTitles = titles
    .map(id => TITLES_CATALOG.find(t => t.id === id))
    .filter(Boolean)

  const latestTitle = unlockedTitles[unlockedTitles.length - 1]

  return (
    <div className="rounded-xl border-2 border-gold/50 bg-panel flex flex-col items-center gap-2 p-4 relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-gold/3 pointer-events-none" />

      {/* Cabecera */}
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold/60">Se busca</p>

      {/* Retrato con inicial */}
      <div className="w-16 h-16 rounded-full bg-gold/15 border-2 border-gold/30 flex items-center justify-center">
        <span className="text-3xl font-black text-gold-bright" style={{ fontFamily: 'var(--font-display)' }}>
          {character.name[0]}
        </span>
      </div>

      {/* Nombre y rol */}
      <div className="text-center">
        <p className="text-sm font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>{character.name}</p>
        <p className="text-[10px] text-ink-3">{character.role}</p>
      </div>

      {/* Título más reciente */}
      {latestTitle && (
        <span className="text-[10px] text-gold/70 italic">✦ {latestTitle.label}</span>
      )}

      {/* Bounty */}
      <div className="text-center mt-1">
        <p className="text-[10px] uppercase tracking-widest text-ink-off mb-0.5">Recompensa</p>
        <p className="text-xl font-black text-gold-bright" style={{ fontFamily: 'var(--font-display)' }}>
          {displayBounty.toLocaleString()} B
        </p>
        {isRaised && (
          <p className="text-[10px] text-gold/50 mt-0.5">
            ↑ +{((displayBounty - (character.bounty ?? 0)) / 1_000_000).toFixed(1)}M desde el inicio
          </p>
        )}
      </div>

      {/* Pills de títulos desbloqueados */}
      {unlockedTitles.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center mt-1">
          {unlockedTitles.map(title => (
            <span
              key={title.id}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/20 text-gold-bright"
            >
              {title.icon} {title.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
