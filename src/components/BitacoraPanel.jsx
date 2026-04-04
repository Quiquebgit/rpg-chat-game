import { useState } from 'react'
import WorldNpcPanel from './WorldNpcPanel'
import WorldMap from './WorldMap'
import { WantedPosterCard } from './WantedPosterCard'
import { ShopPanel } from './ShopPanel'
import { REPUTATION_CONFIG } from '../data/constants'

// Niveles de reputación de tripulación
function reputationLevel(rep) {
  if (rep >= 300) return { label: 'Legendaria', color: 'text-gold-bright' }
  if (rep >= 100) return { label: 'Conocidos',  color: 'text-navigation-light' }
  return { label: 'Novatos', color: 'text-ink-3' }
}

// Drawer lateral con bitácora de la sesión: Enemigos | Mapa | Tripulación | Tienda
export default function BitacoraPanel({
  open, onClose,
  npcs, locations, connections,
  characterStates, presentedCharacters,
  session, currentMoney, onBuyItem,
}) {
  const [tab, setTab] = useState('enemies')

  if (!open) return null

  const crewReputation = session?.crew_reputation ?? 0
  const repLevel = reputationLevel(crewReputation)

  const TABS = [
    { id: 'enemies',  label: 'Enemigos',    icon: '⚔️',  count: npcs.length },
    { id: 'map',      label: 'Mapa',        icon: '🗺️',  count: locations.length },
    { id: 'crew',     label: 'Tripulación', icon: '🏴‍☠️', count: (presentedCharacters || []).length },
    { id: 'shop',     label: 'Tienda',      icon: '🛒',  count: null },
  ]

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-canvas/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — ampliado a max-w-md para tienda y carteles */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-panel border-l border-stroke flex flex-col shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stroke shrink-0">
          <h2 className="text-sm font-bold text-gold-bright uppercase tracking-widest">📖 Bitácora</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-raised transition-colors"
            aria-label="Cerrar bitácora"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stroke shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors whitespace-nowrap px-2 ${
                tab === t.id
                  ? 'text-gold-bright border-b-2 border-gold'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1 text-[10px] text-ink-off">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'enemies' && (
            npcs.length === 0
              ? (
                <div className="flex flex-col items-center gap-3 mt-12 px-4 text-center">
                  <span className="text-4xl opacity-30">⚔️</span>
                  <p className="text-sm font-semibold text-ink-3">Sin enemigos registrados</p>
                  <p className="text-xs text-ink-off leading-relaxed">Los enemigos importantes que encontréis quedarán registrados aquí para futuras aventuras.</p>
                </div>
              )
              : <WorldNpcPanel npcs={npcs} />
          )}

          {tab === 'map' && (
            locations.length === 0
              ? (
                <div className="flex flex-col items-center gap-3 mt-12 px-4 text-center">
                  <span className="text-4xl opacity-30">🗺️</span>
                  <p className="text-sm font-semibold text-ink-3">El mapa está en blanco</p>
                  <p className="text-xs text-ink-off leading-relaxed">El mapa se irá completando a medida que exploréis el mundo. Cada isla y puerto que visitéis quedará registrado aquí.</p>
                </div>
              )
              : <WorldMap locations={locations} connections={connections} />
          )}

          {tab === 'crew' && (
            <div className="flex flex-col gap-4">
              {/* Reputación de tripulación */}
              <div className="rounded-lg border border-gold/20 bg-gold/5 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-ink-off mb-0.5">Reputación de tripulación</p>
                  <p className={`text-sm font-bold ${repLevel.color}`}>⚓ {crewReputation} pts — {repLevel.label}</p>
                </div>
                <div className="text-right text-[10px] text-ink-3">
                  <p>+{REPUTATION_CONFIG.ADVENTURE_COMPLETE} por aventura</p>
                  <p>+{REPUTATION_CONFIG.BOSS_DEFEATED} por boss</p>
                </div>
              </div>

              {/* Carteles de personajes activos */}
              {(presentedCharacters || []).length === 0 ? (
                <p className="text-center text-ink-off italic text-sm mt-4">Ningún personaje en partida.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(presentedCharacters || []).map(char => {
                    const state = (characterStates || []).find(s => s.character_id === char.id)
                    return (
                      <WantedPosterCard
                        key={char.id}
                        character={char}
                        bountyCurrentOverride={state?.bounty_current ?? null}
                        titles={state?.titles || []}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'shop' && (
            <ShopPanel
              currentMoney={currentMoney ?? 0}
              onBuyItem={onBuyItem}
              sessionSuppliesDays={session?.supplies_days ?? null}
            />
          )}
        </div>
      </div>
    </>
  )
}
