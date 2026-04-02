// Panel superior que muestra el estado del modo de juego activo
// Se oculta en modo 'normal'. Se actualiza en tiempo real para todos los jugadores.

import { ATTITUDE_STYLES, ABILITY_TRIGGER_LABELS, ABILITY_EFFECT_LABELS } from '../data/constants'

// --- Modo Combate ---
function EnemyCard({ enemy }) {
  const hpPct = enemy.hp_max > 0 ? Math.max(0, enemy.hp / enemy.hp_max) : 0
  const isCritical = !enemy.defeated && hpPct <= 0.25
  const isWounded  = !enemy.defeated && !isCritical && hpPct <= 0.5
  const hpBarColor = enemy.defeated ? 'bg-gray-600'
    : isCritical ? 'bg-red-500'
    : isWounded  ? 'bg-yellow-500'
    : 'bg-green-500'
  const ability = enemy.ability

  return (
    <div className={`relative flex flex-col gap-2 rounded-lg border px-3 py-2.5 min-w-[160px] max-w-[220px] bg-red-950/30 border-red-500/30 transition-all duration-500 ${enemy.defeated ? 'opacity-40 grayscale' : ''}`}>
      {enemy.defeated && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
          <span className="text-3xl">✕</span>
        </div>
      )}

      {/* Cabecera: icono + nombre + estado */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-lg leading-none">{enemy.icon || '👾'}</span>
          <span className="text-xs font-bold text-red-200 truncate">{enemy.name}</span>
        </div>
        {!enemy.defeated && (
          <span className={`text-xs font-semibold shrink-0 ${isCritical ? 'text-red-400' : isWounded ? 'text-yellow-400' : 'text-green-400'}`}>
            {isCritical ? '💀' : isWounded ? '🩸' : '●'}
          </span>
        )}
      </div>
      {enemy.bounty > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-xs font-semibold text-amber-300 w-fit">
          ☠️ {enemy.bounty.toLocaleString()} B
        </div>
      )}

      {/* Barra de HP */}
      <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${hpBarColor}`}
          style={{ width: `${hpPct * 100}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>❤️ {Math.max(0, enemy.hp)}/{enemy.hp_max}</span>
        <span>⚔️ {enemy.attack} &nbsp;🛡️ {enemy.defense}</span>
      </div>

      {/* Habilidad especial */}
      {ability && (
        <div className="rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1.5">
          <p className="text-xs font-semibold text-amber-300 mb-0.5">✦ {ability.name}</p>
          <p className="text-xs text-gray-500 leading-tight">
            {ABILITY_TRIGGER_LABELS[ability.trigger] || ability.trigger}
            {' · '}
            {ABILITY_EFFECT_LABELS[ability.effect] || ability.effect}
          </p>
        </div>
      )}
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
          <span className="text-xs text-gray-500">— turno de{' '}
            <span
              className="text-amber-300 font-semibold"
              style={{ animation: 'glow-pulse 2s ease-in-out infinite' }}
            >
              {currentTurnName}
            </span>
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {enemies.map(enemy => <EnemyCard key={enemy.id} enemy={enemy} />)}
      </div>
    </div>
  )
}

// --- Modo Navegación ---
function NavigationPanel({ data, totalPlayers = 0, canActInNav, sending, onSacrifice, onRiskyMove, onTurnBack }) {
  const {
    danger_name, danger_threshold = 10, navigation_accumulated = 0,
    navigation_rolls = [], options_visible = false, risky_move_used = false,
  } = data || {}
  const pct = Math.min(1, navigation_accumulated / danger_threshold)
  const barColor = pct >= 1 ? 'bg-green-500' : pct >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
  const labelColor = pct >= 1 ? 'text-green-400' : pct >= 0.5 ? 'text-yellow-300' : 'text-red-400'
  const rolledCount = navigation_rolls.length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-blue-400">🌊 Navegación en curso</span>
        {totalPlayers > 0 && (
          <span className="text-xs text-gray-500">
            Tiradas: <span className={rolledCount >= totalPlayers ? 'text-green-400 font-semibold' : 'text-blue-300 font-semibold'}>{rolledCount}/{totalPlayers}</span>
          </span>
        )}
      </div>
      {danger_name && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-300 font-semibold">{danger_name}</span>
            <span className={`font-semibold ${labelColor}`}>{navigation_accumulated} / {danger_threshold}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {navigation_accumulated >= danger_threshold
              ? '✅ Navegación superada'
              : `Faltan ${danger_threshold - navigation_accumulated} punto${danger_threshold - navigation_accumulated !== 1 ? 's' : ''} para superar el peligro`}
          </p>
        </div>
      )}

      {/* Opciones de fallo — disponibles para todos los jugadores simultáneamente */}
      {options_visible && canActInNav && (
        <div className="flex flex-wrap gap-2 mt-1 border-t border-gray-800 pt-2">
          <button
            onClick={onSacrifice}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/40 border border-red-500/30 text-red-300 hover:bg-red-900/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ❤️ Sacrificar 1 vida (+1 nav)
          </button>
          {!risky_move_used && (
            <button
              onClick={onRiskyMove}
              disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-900/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ⚡ Arriesgarse (todos −1 HP, umbral −{totalPlayers || '?'})
            </button>
          )}
          <button
            onClick={onTurnBack}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            🔙 Dar la vuelta
          </button>
        </div>
      )}
    </div>
  )
}

// --- Modo Exploración ---
function ExplorationPanel({ data, explorationNodeId, onNavigate }) {
  const tree = data?.exploration_tree
  const currentNode = tree?.nodes?.find(n => n.id === explorationNodeId)
    ?? tree?.nodes?.find(n => n.id === tree?.start_node_id)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-green-400">🗺️ Explorando</span>
      {!tree ? (
        <p className="text-xs text-gray-600 italic animate-pulse">Generando mapa de exploración…</p>
      ) : !currentNode ? (
        <p className="text-xs text-gray-600 italic">Preparando la exploración…</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-300 leading-relaxed">{currentNode.description}</p>
          {!currentNode.is_goal && currentNode.options?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentNode.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate?.(opt.next_node_id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-900/40 border border-green-500/30 text-green-300 hover:bg-green-900/60 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
      {conviction_max > 0 && (
        <div className="flex items-center gap-3">
          <div className={`rounded-lg border px-3 py-1.5 ${attStyle.bg} ${attStyle.border}`}>
            <p className="text-xs font-bold text-gray-200">{npc_name || 'NPC'}</p>
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
export default function GameModePanel({ gameMode, gameModeData, currentTurnName, sending, canActInNav, totalPlayers, onSacrifice, onRiskyMove, onTurnBack, explorationNodeId, onNavigateExploration }) {
  if (!gameMode || gameMode === 'normal') return null

  return (
    <div className="shrink-0 border-b border-gray-800 px-6 py-3">
      {gameMode === 'combat'      && <CombatPanel      data={gameModeData} currentTurnName={currentTurnName} />}
      {gameMode === 'navigation'  && <NavigationPanel  data={gameModeData} totalPlayers={totalPlayers} canActInNav={canActInNav} sending={sending} onSacrifice={onSacrifice} onRiskyMove={onRiskyMove} onTurnBack={onTurnBack} />}
      {gameMode === 'exploration' && <ExplorationPanel data={gameModeData} explorationNodeId={explorationNodeId} onNavigate={onNavigateExploration} />}
      {gameMode === 'negotiation' && <NegotiationPanel data={gameModeData} />}
    </div>
  )
}
