import { useState } from 'react'
import { LOCATION_TYPE_STYLES } from '../data/constants'

function LocationTooltip({ location, onClose }) {
  const style = LOCATION_TYPE_STYLES[location.location_type] || LOCATION_TYPE_STYLES.island

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-w-sm w-full rounded-2xl border border-gold/40 bg-canvas p-5 flex flex-col gap-3 shadow-2xl shadow-gold/20"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{style.icon}</span>
          <div>
            <h3 className="text-lg font-bold text-gold-bright" style={{ fontFamily: 'var(--font-display)' }}>
              {location.name}
            </h3>
            <span className="text-xs text-ink-3 uppercase tracking-widest">{style.label}</span>
          </div>
        </div>
        {location.description && (
          <p className="text-sm text-ink-2 leading-relaxed">{location.description}</p>
        )}
        <button
          onClick={onClose}
          className="self-end text-xs text-ink-3 hover:text-ink-2 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

export default function WorldMap({ locations, connections }) {
  const [selectedLocation, setSelectedLocation] = useState(null)

  if (!locations?.length) {
    return (
      <div className="flex items-center justify-center py-12 text-ink-3 text-sm">
        Aún no se han descubierto ubicaciones. ¡Explora el mundo!
      </div>
    )
  }

  // Construir mapa de conexiones bidireccional para renderizar edges
  const edges = (connections || []).map(conn => {
    const from = locations.find(l => l.id === conn.from_location_id)
    const to = locations.find(l => l.id === conn.to_location_id)
    if (!from?.coordinates || !to?.coordinates) return null
    return { from, to, distance: conn.distance_days }
  }).filter(Boolean)

  return (
    <div className="relative">
      <svg
        viewBox="0 0 800 600"
        className="w-full h-auto max-h-[500px] rounded-xl border border-stroke bg-panel"
        style={{ minHeight: '300px' }}
      >
        {/* Fondo con gradiente oceánico */}
        <defs>
          <radialGradient id="ocean-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="var(--mode-navigation)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="800" height="600" fill="url(#ocean-bg)" />

        {/* Edges (conexiones entre ubicaciones) */}
        {edges.map((edge, i) => {
          const midX = (edge.from.coordinates.x + edge.to.coordinates.x) / 2
          const midY = (edge.from.coordinates.y + edge.to.coordinates.y) / 2
          return (
            <g key={`edge-${i}`}>
              <line
                x1={edge.from.coordinates.x}
                y1={edge.from.coordinates.y}
                x2={edge.to.coordinates.x}
                y2={edge.to.coordinates.y}
                stroke="var(--border-stroke-2)"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.6"
              />
              {/* Etiqueta de distancia */}
              <text
                x={midX}
                y={midY - 8}
                textAnchor="middle"
                fill="var(--text-ink-3)"
                fontSize="9"
                fontWeight="600"
              >
                {edge.distance}d
              </text>
            </g>
          )
        })}

        {/* Nodos (ubicaciones) */}
        {locations.map(loc => {
          if (!loc.coordinates) return null
          const style = LOCATION_TYPE_STYLES[loc.location_type] || LOCATION_TYPE_STYLES.island
          const { x, y } = loc.coordinates

          return (
            <g
              key={loc.id}
              className="cursor-pointer"
              onClick={() => setSelectedLocation(loc)}
            >
              {/* Círculo de fondo con glow */}
              <circle
                cx={x}
                cy={y}
                r="22"
                fill={style.fill}
                opacity="0.15"
              />
              {/* Círculo principal */}
              <circle
                cx={x}
                cy={y}
                r="16"
                fill={style.fill}
                opacity="0.9"
                stroke="var(--border-stroke)"
                strokeWidth="1.5"
              />
              {/* Icono */}
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12"
              >
                {style.icon}
              </text>
              {/* Nombre */}
              <text
                x={x}
                y={y + 28}
                textAnchor="middle"
                fill="var(--text-ink)"
                fontSize="10"
                fontWeight="600"
              >
                {loc.name.length > 14 ? loc.name.slice(0, 12) + '…' : loc.name}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Modal de detalle */}
      {selectedLocation && (
        <LocationTooltip
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}
    </div>
  )
}
