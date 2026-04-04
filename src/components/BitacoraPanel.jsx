import { useState } from 'react'
import WorldNpcPanel from './WorldNpcPanel'
import WorldMap from './WorldMap'

// Drawer lateral con el mundo persistente de la sesión actual.
// Tabs: Enemigos conocidos | Mapa del mundo
export default function BitacoraPanel({ open, onClose, npcs, locations, connections }) {
  const [tab, setTab] = useState('enemies')

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-canvas/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-panel border-l border-stroke flex flex-col shadow-2xl">
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
        <div className="flex border-b border-stroke shrink-0">
          {[
            { id: 'enemies', label: 'Enemigos', icon: '⚔️', count: npcs.length },
            { id: 'map',     label: 'Mapa',     icon: '🗺️', count: locations.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                tab === t.id
                  ? 'text-gold-bright border-b-2 border-gold'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
              {t.count > 0 && <span className="ml-1 text-[10px] text-ink-off">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'enemies' && (
            npcs.length === 0
              ? <p className="text-center text-ink-off italic text-sm mt-8">Ningún enemigo registrado aún.</p>
              : <WorldNpcPanel npcs={npcs} />
          )}
          {tab === 'map' && (
            locations.length === 0
              ? <p className="text-center text-ink-off italic text-sm mt-8">Ninguna ubicación descubierta aún.</p>
              : <WorldMap locations={locations} connections={connections} />
          )}
        </div>
      </div>
    </>
  )
}
