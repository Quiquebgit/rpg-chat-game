// Panel superior que muestra el estado del modo de juego activo
// Se oculta en modo 'normal'. Se actualiza en tiempo real para todos los jugadores.

const ATTITUDE_STYLES = {
  hostile:  { label: 'Hostil',    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30' },
  neutral:  { label: 'Neutral',   color: 'text-gray-300',   bg: 'bg-gray-800',      border: 'border-gray-700' },
  friendly: { label: 'Amistoso',  color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30' },
}

// --- Modo Combate ---
function EnemyCard({ enemy }) {
  const hpPct = enemy.hp_max > 0 ? Math.max(0, enemy.hp / enemy.hp_max) : 0
  return (
    <div className={`relative flex flex-col gap-1.5 rounded-lg border px-3 py-2 min-w-[110px] bg-red-950/30 border-red-500/30 ${enemy.defeated ? 'opacity-40' : ''}`}>
      {enemy.defeated && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
          <span className="text-2xl">✕</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none">{enemy.icon || '👾'}</span>
        <span className="text-xs font-bold text-red-200 truncate">{enemy.name}</span>
      </div>
      {/* Barra de HP */}
      <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-red-500 transition-all duration-500"
          style={{ width: `${hpPct * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>❤️ {Math.max(0, enemy.hp)}/{enemy.hp_max}</span>
        <span>⚔️{enemy.attack} 🛡️{enemy.defense}</span>
      </div>
    </div>
  )
}

function CombatPanel({ data, currentTurnName }) {
  const enemies = data?.enemies || []
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-black uppercase tracking-widest text-red-400">⚔️ Combate en curso</span>
        {currentTurnName && (
          <span className="text-xs text-gray-500">— turno de <span className="text-gray-300 font-semibold">{currentTurnName}</span></span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {enemies.map(enemy => <EnemyCard key={enemy.id} enemy={enemy} />)}
      </div>
    </div>
  )
}

// --- Modo Navegación ---
function NavigationPanel({ data }) {
  const { danger_name, danger_threshold = 10, progress = 0 } = data || {}
  const pct = Math.min(1, progress / danger_threshold)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-blue-400">🌊 Navegación en curso</span>
      {danger_name && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-300 font-semibold">{danger_name}</span>
            <span className="text-blue-300">Umbral: {danger_threshold}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">Navegación acumulada: {progress} / {danger_threshold}</p>
        </div>
      )}
    </div>
  )
}

// --- Modo Exploración ---
function ExplorationPanel({ data }) {
  const clues = data?.clues || []
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-green-400">🗺️ Explorando</span>
      {clues.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {clues.map((clue, i) => (
            <li key={i} className="text-xs text-gray-400 flex gap-1.5">
              <span className="text-green-500 shrink-0">◆</span>
              <span>{clue}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-600 italic">Sin pistas descubiertas aún.</p>
      )}
    </div>
  )
}

// --- Modo Negociación ---
function NegotiationPanel({ data }) {
  const { npc_name, npc_attitude = 'neutral', conviction = 0, conviction_max = 10 } = data || {}
  const attStyle = ATTITUDE_STYLES[npc_attitude] || ATTITUDE_STYLES.neutral
  const pct = conviction_max > 0 ? Math.max(0, Math.min(1, conviction / conviction_max)) : 0
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-amber-400">💬 Negociación en curso</span>
      {npc_name && (
        <div className="flex items-center gap-3">
          <div className={`rounded-lg border px-3 py-1.5 ${attStyle.bg} ${attStyle.border}`}>
            <p className="text-xs font-bold text-gray-200">{npc_name}</p>
            <p className={`text-xs font-semibold ${attStyle.color}`}>{attStyle.label}</p>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Convicción</span>
              <span>{conviction}/{conviction_max}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${pct * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Panel principal ---
export default function GameModePanel({ gameMode, gameModeData, currentTurnName }) {
  if (!gameMode || gameMode === 'normal') return null

  return (
    <div className="shrink-0 border-b border-gray-800 px-6 py-3">
      {gameMode === 'combat'      && <CombatPanel      data={gameModeData} currentTurnName={currentTurnName} />}
      {gameMode === 'navigation'  && <NavigationPanel  data={gameModeData} />}
      {gameMode === 'exploration' && <ExplorationPanel data={gameModeData} />}
      {gameMode === 'negotiation' && <NegotiationPanel data={gameModeData} />}
    </div>
  )
}
