import { useState, useEffect, useRef } from 'react'
import { useMessages } from '../hooks/useMessages'
import { usePresence } from '../hooks/usePresence'
import { useNarration } from '../hooks/useNarration'
import { useDirector } from '../hooks/useDirector'
import { characters as allCharacters } from '../data/characters'
import { MODE_SHADOW, XP_CONFIG, UPGRADABLE_STATS, STAT_LABELS } from '../data/constants'
import GameModePanel from '../components/GameModePanel'
import { NarratorMessage, NarratorTyping, NpcMessage } from '../components/NarratorMessage'
import { ActionMessage, OocMessage, GmMessage, PlayerMessage } from '../components/ChatMessages'
import { DiceMessage } from '../components/DiceMessage'
import { PreGameScreen } from '../components/PreGameScreen'
import { InventoryPanel, DebugInventoryButton } from '../components/InventoryPanel'
import { CollapsibleAbility } from '../components/CollapsibleAbility'
import { StatRow } from '../components/StatRow'
import { StatBoostPanel, HealPanel } from '../components/StatBoostPanel'

function GameRoom({ character, session, onLeave, onSelectCharacter }) {
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [actionMode, setActionMode] = useState(true)
  const [useNavAbility, setUseNavAbility] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastNarratedIdRef = useRef(null)

  const { presentIds, participantIds, isParticipant, broadcastGameStart, markAsParticipant } = usePresence(session, character)
  const { completeCurrentEvent, currentEventSetup } = useDirector(session)
  const { messages, sending, narratorTyping, sendMessage, sendChat, sendAction, sendGmMessage, diceRequest, rollDice, rollInitiative, rollNavigation, sacrificeForNavigation, riskyMove, turnBack, characterStates, gameMode, gameModeData, startGame, announceEntry, debugAddItem, useItem, giftItem, killCharacter, explorationNodeId, navigateExplorationNode, applyStatUpgrade, setGameModeDirect } = useMessages(session, character, presentIds, completeCurrentEvent, currentEventSetup)
  const { speak, stop, isNarrating, isEnabled: narrationEnabled, toggle: toggleNarration, error: narrationError, supported: narrationSupported } = useNarration()

  // Narrar automáticamente los mensajes nuevos del narrador
  useEffect(() => {
    if (!messages.length) return
    const last = messages[messages.length - 1]
    if (last.type === 'narrator' && last.id !== lastNarratedIdRef.current) {
      lastNarratedIdRef.current = last.id
      speak(last.content)
    }
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasStarted = messages.length > 0
  const isSpectator = hasStarted && !isParticipant
  const presentedCharacters = allCharacters.filter(c => presentIds.includes(c.id))

  // gameMode y gameModeData vienen del hook (actualización inmediata + sync via Realtime)

  async function handleStartGame() {
    // Marcar al iniciador y notificar al resto de presentes como participantes
    markAsParticipant()
    broadcastGameStart(presentIds)
    await startGame()
  }

  async function handleAnnounceEntry() {
    await announceEntry()
    markAsParticipant()
  }

  // Estado actual del personaje propio (vida e inventario en tiempo real)
  const activeCharacterState = characterStates.find(s => s.character_id === character.id)
  const hpCurrent = activeCharacterState?.hp_current ?? character.hp
  const inventory = activeCharacterState?.inventory || []
  const hasFruit = inventory.some(i => i.is_fruit || (i.type === 'fruta' && i.equipped))
  const equippedFruit = inventory.find(i => i.is_fruit || (i.type === 'fruta' && i.equipped))
  const isDead = activeCharacterState?.is_dead ?? false

  // Economía y XP del personaje activo
  const currentMoney = activeCharacterState?.money ?? 0
  const currentXp = activeCharacterState?.xp ?? 0
  const statUpgrades = activeCharacterState?.stat_upgrades ?? {}
  const xpProgress = currentXp % XP_CONFIG.THRESHOLD
  const pendingStatUpgrades = gameModeData?.pending_stat_upgrades ?? []
  const myStatUpPending = pendingStatUpgrades.includes(character.id)

  // Bonificaciones de items equipados + frutas activas (suma por stat)
  const equipmentBonuses = inventory
    .filter(i => i.equipped || i.is_fruit)
    .flatMap(i => i.effects || [])
    .reduce((acc, e) => ({ ...acc, [e.stat]: (acc[e.stat] || 0) + (e.modifier || e.value || 0) }), {})

  // Boost de combate activo (Liderazgo, éxito crítico…) — solo durante el combate
  const combatBoosts = gameMode === 'combat' ? (gameModeData?.boosts?.[character.id] || {}) : {}

  // Stats efectivos (base + equipo + frutas) para mostrar en botones y labels
  const effectiveAtk = character.attack + (equipmentBonuses.attack || 0)
  const effectiveNav = character.navigation + (equipmentBonuses.navigation || 0)

  // Selector de modo GM (se abre con /gm solo, sin texto)
  const [showGmModeSelector, setShowGmModeSelector] = useState(false)

  // Modal de confirmación antes de comer una fruta del diablo
  const [fruitConfirmItem, setFruitConfirmItem] = useState(null)
  // Modal de muerte por segunda fruta del diablo
  const [fruitDeathConfirm, setFruitDeathConfirm] = useState(false)
  const [fruitFlash, setFruitFlash] = useState(false)
  const prevHasFruit = useRef(hasFruit)
  useEffect(() => {
    if (!prevHasFruit.current && hasFruit) {
      setFruitFlash(true)
      setTimeout(() => setFruitFlash(false), 2000)
    }
    prevHasFruit.current = hasFruit
  }, [hasFruit])

  // ¿Es el turno de este jugador?
  const currentTurnName = allCharacters.find(c => c.id === session?.current_turn_character_id)?.name
  const isMyTurn = session?.current_turn_character_id === character.id && !isDead

  // Tirada de navegación: en modo navigation y es el turno de este jugador
  // En navegación no hay turnos: cada jugador tira cuando quiera, si aún no lo ha hecho esta ronda
  const navigationRolls = gameModeData?.navigation_rolls || []
  const needsNavigationRoll = gameMode === 'navigation'
    && !isSpectator && !isDead
    && !navigationRolls.includes(character.id)
  // Cualquier personaje con ability.type === 'navigation_bonus' puede usarlo si no lo ha gastado esta sesión
  const navBonusAbility = character.ability?.type === 'navigation_bonus' ? character.ability : null
  const navBonusAvailable = navBonusAbility
    && needsNavigationRoll
    && !(characterStates.find(s => s.character_id === character.id)?.ability_used ?? false)

  // Desafío sostenido activo (fuera de combate)
  const sustainedChallenge = gameMode !== 'combat' ? gameModeData?.sustained_challenge : null
  const needsSustainedRoll = !!sustainedChallenge && isMyTurn && !diceRequest.required

  // Iniciativa pendiente: en combate, el orden no está fijado aún, y este jugador no ha tirado
  const needsInitiativeRoll = gameMode === 'combat'
    && gameModeData
    && !gameModeData.combat_turn_order
    && !gameModeData.initiative?.[character.id]
    && !isSpectator
    && !isDead

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!sending && !isSpectator) inputRef.current?.focus()
  }, [sending])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')

    // Si era espectador, promover a participante automáticamente al hablar
    if (isSpectator) markAsParticipant()

    // Personaje muerto: solo puede enviar mensajes de conversación
    if (isDead) {
      await sendChat(text)
      return
    }

    if (text === '/gm') {
      setShowGmModeSelector(true)
    } else if (text.startsWith('/gm ')) {
      await sendGmMessage(text.slice(4).trim())
    } else if (text.startsWith('/')) {
      await sendAction(text.slice(1).trim())
    } else if (isMyTurn && !actionMode) {
      await sendChat(text)
    } else {
      await sendMessage(text)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="flex h-screen bg-gray-950 text-white overflow-hidden transition-shadow duration-700"
      style={gameMode !== 'normal' ? { boxShadow: MODE_SHADOW[gameMode] } : undefined}
    >

      {/* Overlay sidebar izquierda */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Overlay menú derecho */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Overlay panel jugadores */}
      {playersOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setPlayersOpen(false)}
        />
      )}

      {/* Panel menú derecho deslizante */}
      <nav className={`
        fixed right-0 top-0 z-30 h-full
        w-64 bg-gray-900 border-l border-gray-800 flex flex-col py-6 gap-2
        transition-transform duration-300 ease-in-out
        ${menuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-5 mb-4">
          <span className="text-xs uppercase tracking-widest text-gray-500">Menú</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Cerrar menú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => { setMenuOpen(false); onLeave() }}
          className="w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Pantalla de inicio
        </button>
        <button
          onClick={() => { setMenuOpen(false); onSelectCharacter() }}
          className="w-full text-left px-5 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Selección de personaje
        </button>
      </nav>

      {/* Lengüeta lateral */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed left-0 top-0 h-full z-30 w-7 bg-gray-900/80 backdrop-blur border-r border-amber-400/20 flex items-center justify-center"
          aria-label="Abrir panel de personaje"
        >
          <span className="text-amber-400 text-2xl font-light leading-none">›</span>
        </button>
      )}

      {/* Panel lateral */}
      <aside className={`
        fixed md:relative z-20 h-full
        w-[23rem] shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col pr-7 pl-5 py-5 gap-4
        overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden absolute right-0 top-0 h-full w-7 bg-gray-900/80 backdrop-blur flex items-center justify-center"
          aria-label="Cerrar panel"
        >
          <span className="text-amber-400 text-2xl font-light leading-none">‹</span>
        </button>

        <div className={`relative rounded-lg p-3 transition-all duration-300 ${isDead ? 'opacity-60' : ''} ${fruitFlash ? 'ring-2 ring-purple-400 bg-purple-400/10 animate-pulse' : hasFruit ? 'ring-1 ring-purple-500/40' : ''}`}>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Jugando como</p>
          <div className="flex items-center gap-2">
            <h2 className={`text-2xl font-bold ${isDead ? 'line-through text-gray-500' : 'text-amber-300'}`}>
              {character.name}
            </h2>
            {isDead && <span title="Fuera de combate" className="text-xl leading-none">☠️</span>}
            {!isDead && hasFruit && (
              <span title="Portador de fruta del diablo" className="text-lg leading-none">🍎</span>
            )}
          </div>
          <p className={`text-sm uppercase tracking-widest ${isDead ? 'text-gray-600' : 'text-gray-400'}`}>{character.role}</p>
          <p className="text-xs text-gray-600 italic mt-1">{character.combatStyle}</p>
          {isDead && (
            <p className="text-xs text-red-400/70 mt-1 font-semibold">— Fuera de combate —</p>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Vida</p>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: character.hp }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-3 shrink-0 rotate-45 ${i < hpCurrent ? 'bg-red-500' : 'bg-gray-700'}`}
                  style={{ clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)' }}
                />
              ))}
            </div>
            <span className="text-sm font-bold text-red-400">{hpCurrent}/{character.hp}</span>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Stats</p>
          <div className="flex flex-col gap-3">
            <StatRow icon="⚔️" label="Ataque" value={character.attack} bonus={(equipmentBonuses.attack || 0) + (combatBoosts.attack || 0)} color="bg-amber-400" />
            <StatRow icon="🛡️" label="Defensa" value={character.defense} bonus={(equipmentBonuses.defense || 0) + (combatBoosts.defense || 0)} color="bg-blue-400" />
            <StatRow icon="🧭" label="Navegación" value={character.navigation} bonus={(equipmentBonuses.navigation || 0) + (combatBoosts.navigation || 0)} color="bg-green-400" />
          </div>
        </div>

        {/* Destreza y Carisma */}
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Destreza / Carisma</p>
          <div className="flex flex-col gap-3">
            <StatRow icon="🤸" label="Destreza" value={character.dexterity ?? 0} bonus={(equipmentBonuses.dexterity || 0) + (combatBoosts.dexterity || 0) + (statUpgrades.dexterity || 0)} color="bg-orange-400" />
            <StatRow icon="💬" label="Carisma"  value={character.charisma  ?? 0} bonus={(equipmentBonuses.charisma  || 0) + (combatBoosts.charisma  || 0) + (statUpgrades.charisma  || 0)} color="bg-pink-400" />
          </div>
        </div>

        {/* Economía: berries, bounty y XP */}
        <div className="border border-amber-400/20 rounded-lg p-3 bg-amber-400/5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Economía</p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">💰 Berries</span>
              <span className="text-amber-300 font-semibold">{currentMoney.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">☠️ Recompensa</span>
              <span className="text-red-300 font-semibold">{character.bounty?.toLocaleString() ?? 0} B</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>⭐ XP</span>
              <span>{currentXp} (+{xpProgress}/{XP_CONFIG.THRESHOLD})</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${(xpProgress / XP_CONFIG.THRESHOLD) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <CollapsibleAbility
          label="Habilidad especial"
          name={character.ability.name}
          description={character.ability.description}
          borderColor="border-amber-400/40"
          bgColor="bg-amber-400/5"
          labelColor="text-amber-500/70"
          nameColor="text-amber-300"
        />
        {equippedFruit?.special_ability && (
          <CollapsibleAbility
            label="🍎 Poder de fruta"
            name={equippedFruit.name}
            description={equippedFruit.special_ability}
            effects={equippedFruit.effects}
            borderColor="border-purple-400/40"
            bgColor="bg-purple-400/5"
            labelColor="text-purple-500/70"
            nameColor="text-purple-300"
          />
        )}

        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Inventario</p>
          <div>
            <InventoryPanel
              inventory={inventory}
              isMyTurn={isMyTurn}
              allies={presentedCharacters.filter(c => c.id !== character.id)}
              onUse={(item, i) => item.type === 'fruta' && !item.equipped ? setFruitConfirmItem({ item, i }) : useItem(item, i)}
              onGift={giftItem}
            />
          </div>
          {import.meta.env.DEV && (
            <DebugInventoryButton onAdd={debugAddItem} />
          )}
        </div>

      </aside>

      {/* Modal de stat-up por XP */}
      {myStatUpPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-yellow-400/40 bg-gray-950 p-6 flex flex-col gap-4 shadow-2xl shadow-yellow-900/30">
            <div className="text-center">
              <p className="text-4xl mb-3">⭐</p>
              <h3 className="text-xl font-bold text-yellow-300">¡Has subido de nivel!</h3>
              <p className="text-sm text-gray-400 mt-2">Elige un stat para mejorar en +1:</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {UPGRADABLE_STATS.map(stat => (
                <button
                  key={stat}
                  onClick={() => applyStatUpgrade(character.id, stat)}
                  className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-sm font-medium text-yellow-300 hover:bg-yellow-400/20 transition-colors"
                >
                  {STAT_LABELS[stat] ?? stat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación fruta del diablo */}
      {fruitConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-purple-400/40 bg-gray-950 p-6 flex flex-col gap-4 shadow-2xl shadow-purple-900/30">
            <div className="text-center">
              <p className="text-4xl mb-3">🍎</p>
              <h3 className="text-lg font-bold text-purple-300 mb-2">¿Comer la fruta del diablo?</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Ganarás poderes extraordinarios al comerla. Esta decisión es <span className="text-purple-300 font-semibold">irreversible</span>.
              </p>
              <p className="text-xs text-gray-600 mt-2 italic">"{fruitConfirmItem.item.name}"</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFruitConfirmItem(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (hasFruit) {
                    // Ya tiene una fruta — mostrar advertencia de muerte
                    setFruitConfirmItem(null)
                    setFruitDeathConfirm(true)
                  } else {
                    useItem(fruitConfirmItem.item, fruitConfirmItem.i)
                    setFruitConfirmItem(null)
                  }
                }}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-500 transition-colors"
              >
                Comerla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de muerte por segunda fruta del diablo */}
      {fruitDeathConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-red-500/60 bg-gray-950 p-6 flex flex-col gap-4 shadow-2xl shadow-red-900/40">
            <div className="text-center">
              <p className="text-4xl mb-3">💀</p>
              <h3 className="text-lg font-bold text-red-400 mb-2">Segunda fruta del diablo</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Si consumes una segunda fruta del diablo, <span className="text-red-400 font-bold">morirás</span>. ¿Estás seguro?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFruitDeathConfirm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { killCharacter(character.id); setFruitDeathConfirm(false) }}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-red-700 text-white hover:bg-red-600 transition-colors"
              >
                Moriré por ella
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selector de modo GM */}
      {showGmModeSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-amber-400/30 bg-gray-950 p-6 flex flex-col gap-4 shadow-2xl">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-amber-500/60 mb-1">GM</p>
              <h3 className="text-lg font-bold text-amber-300">Cambiar modo de juego</h3>
              <p className="text-xs text-gray-600 mt-1">Sin pasar por el modelo — efecto inmediato</p>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { mode: 'normal',      label: '⚓ Normal',       cls: 'border-gray-700 text-gray-300 hover:bg-gray-800' },
                { mode: 'combat',      label: '⚔️ Combate',      cls: 'border-red-500/40 text-red-300 hover:bg-red-900/30' },
                { mode: 'navigation',  label: '🌊 Navegación',   cls: 'border-blue-500/40 text-blue-300 hover:bg-blue-900/30' },
                { mode: 'exploration', label: '🗺️ Exploración',  cls: 'border-green-500/40 text-green-300 hover:bg-green-900/30' },
                { mode: 'negotiation', label: '💬 Negociación',  cls: 'border-amber-500/40 text-amber-300 hover:bg-amber-900/30' },
              ].map(({ mode, label, cls }) => (
                <button
                  key={mode}
                  onClick={() => { setGameModeDirect(mode); setShowGmModeSelector(false) }}
                  disabled={gameMode === mode}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold border bg-transparent transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${cls}`}
                >
                  {label}{gameMode === mode ? ' (activo)' : ''}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowGmModeSelector(false)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors text-center"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Área principal de chat */}
      <main className="flex flex-col flex-1 min-w-0 md:ml-0 ml-7">

        <header className="border-b border-gray-800 px-6 py-4 shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-amber-300">⚓ La aventura comienza</h1>
            <p className="text-xs text-gray-600 mt-0.5">Sesión activa</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón jugadores conectados */}
            <div className="relative">
              <button
                onClick={() => setPlayersOpen(v => !v)}
                className="relative p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                aria-label="Jugadores en sala"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                {presentedCharacters.length > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs bg-amber-400 text-gray-900 rounded-full w-4 h-4 flex items-center justify-center font-black leading-none">
                    {presentedCharacters.length}
                  </span>
                )}
              </button>
              {playersOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-2 border-b border-gray-800">
                    <p className="text-xs uppercase tracking-widest text-gray-600">En la sala</p>
                  </div>
                  {presentedCharacters.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-600 italic">Nadie conectado</p>
                  ) : (
                    presentedCharacters.map(c => {
                      const isP = participantIds.includes(c.id)
                      return (
                        <div key={c.id} className="px-4 py-2.5 flex items-center gap-2">
                          <span className={`text-xs ${isP ? 'text-green-400' : 'text-gray-600'}`}>
                            {isP ? '●' : '👁'}
                          </span>
                          <div>
                            <p className={`text-sm font-medium ${isP ? 'text-gray-200' : 'text-gray-500'}`}>{c.name}</p>
                            <p className="text-xs text-gray-600">{isP ? c.role : 'espectador'}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* Botón narración por voz */}
            {narrationSupported && (
              <button
                onClick={toggleNarration}
                className={`p-2 rounded-lg transition-colors ${
                  narrationEnabled
                    ? 'text-amber-400 hover:text-amber-300 hover:bg-gray-800'
                    : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800'
                }`}
                title={narrationEnabled ? 'Desactivar narración por voz' : 'Activar narración por voz'}
                aria-label={narrationEnabled ? 'Desactivar narración' : 'Activar narración'}
              >
                <span className="text-lg leading-none">{narrationEnabled ? (isNarrating ? '🔊' : '🔈') : '🔇'}</span>
              </button>
            )}

            {/* Botón hamburguesa */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              aria-label="Menú"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </header>

        {narrationError && (
          <div className="shrink-0 px-6 py-2 bg-amber-400/10 border-b border-amber-400/20 flex items-center gap-2">
            <span className="text-xs text-amber-400/80">🔇 {narrationError}</span>
          </div>
        )}

        <GameModePanel
          gameMode={gameMode}
          gameModeData={gameModeData}
          currentTurnName={currentTurnName}
          sending={sending}
          canActInNav={!isSpectator && !isDead}
          totalPlayers={presentIds.length}
          onSacrifice={sacrificeForNavigation}
          onRiskyMove={riskyMove}
          onTurnBack={turnBack}
          explorationNodeId={explorationNodeId}
          onNavigateExploration={navigateExplorationNode}
        />

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {!hasStarted && !sending && (
            <PreGameScreen
              presentedCharacters={presentedCharacters}
              onStart={handleStartGame}
              sending={sending}
            />
          )}
          {messages.map((msg, index) => {
              if (msg.type === 'narrator' && msg.character_id !== 'narrator') {
                return <NpcMessage key={msg.id} name={msg.character_id} content={msg.content} />
              }
              if (msg.type === 'narrator') {
                return (
                  <div key={msg.id} className="flex flex-col items-center gap-2">
                    <NarratorMessage content={msg.content} />
                  </div>
                )
              }
              if (msg.type === 'dice') {
                return (
                  <DiceMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                  />
                )
              }
              if (msg.type === 'action') {
                return (
                  <ActionMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                  />
                )
              }
              if (msg.type === 'gm') {
                return (
                  <GmMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                  />
                )
              }
              if (msg.type === 'ooc') {
                return (
                  <OocMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                  />
                )
              }
              return (
                <PlayerMessage
                  key={msg.id}
                  name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                  content={msg.content}
                  isOwn={msg.character_id === character.id}
                />
              )
          })}
          {narratorTyping && <NarratorTyping />}
          <div ref={messagesEndRef} />
        </div>

        {/* Indicador de turno — solo para participantes */}
        {!sending && !isSpectator && currentTurnName && (
          <div className={`px-6 py-2 shrink-0 flex items-center justify-center gap-2 border-t ${
            isMyTurn
              ? 'border-amber-400/30 bg-amber-400/10'
              : 'border-gray-800 bg-transparent'
          }`}>
            {isMyTurn ? (
              <p className="text-sm font-bold text-amber-300 tracking-wide">⚔️ Es tu turno, {character.name}</p>
            ) : (
              <p className="text-xs text-gray-500">Turno de <span className="text-gray-300 font-semibold">{currentTurnName}</span></p>
            )}
          </div>
        )}

        {/* Input / Botón de dados / Espectador / Iniciativa / Muerte */}
        <div className="border-t border-gray-800 px-6 py-4 shrink-0">
          {isDead ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-center text-red-400/60 uppercase tracking-widest">☠️ Tu personaje está fuera de combate</p>
              <div className="flex gap-3">
                <span className="text-gray-600 font-bold text-sm self-center shrink-0">{character.name}:</span>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Puedes hablar, pero no actuar..."
                  rows={2}
                  disabled={sending}
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-500 placeholder-gray-700 resize-none focus:outline-none"
                />
                <button
                  onClick={() => { sendChat(input); setInput('') }}
                  disabled={!input.trim() || sending}
                  className="px-4 rounded-lg font-bold text-sm bg-gray-800 text-gray-500 hover:bg-gray-700 disabled:opacity-40 transition-colors shrink-0"
                >
                  Enviar
                </button>
              </div>
            </div>
          ) : isSpectator ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-gray-600 uppercase tracking-widest">Estás viendo la partida como espectador</p>
              <button
                onClick={handleAnnounceEntry}
                disabled={sending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-800 border border-amber-400/30 text-amber-300 hover:bg-gray-700 hover:border-amber-400/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>🚪</span>
                Unirme a la aventura
              </button>
            </div>
          ) : needsNavigationRoll ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-blue-400/70 uppercase tracking-widest">🌊 Navegación — tira tus dados</p>
              {navBonusAvailable && (
                <button
                  onClick={() => setUseNavAbility(v => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    useNavAbility
                      ? 'bg-cyan-400/20 border-cyan-400/50 text-cyan-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}
                >
                  <span>{useNavAbility ? '✓' : '○'}</span>
                  {navBonusAbility.name} (+{navBonusAbility.effect?.value ?? navBonusAbility.value ?? 0}) — una vez por sesión
                </button>
              )}
              <button
                onClick={() => { rollNavigation(useNavAbility); setUseNavAbility(false) }}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                Tirar navegación ({currentEventSetup?.dice_count === 2 ? '2d6' : '1d6'} + {effectiveNav} NAV{useNavAbility ? ' +3' : ''})
              </button>
            </div>
          ) : needsInitiativeRoll ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-red-400/70 uppercase tracking-widest">⚔️ ¡Combate! Tira tu iniciativa</p>
              <button
                onClick={rollInitiative}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                Tirar iniciativa (1d6 + {effectiveAtk} ATK)
              </button>
            </div>
          ) : gameMode === 'combat' && gameModeData?.combat_turn_order && !gameModeData.initiative?.[character.id] && !isSpectator && !isDead ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-xs text-red-400/50 uppercase tracking-widest">⚔️ El combate ya ha comenzado</p>
              <p className="text-xs text-gray-600 text-center">No puedes unirte a este combate. Espera al siguiente encuentro.</p>
            </div>
          ) : diceRequest.required && isMyTurn ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-amber-400/70 uppercase tracking-widest">El narrador pide una tirada</p>
              <button
                onClick={rollDice}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-amber-400 text-gray-900 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                {diceRequest.count === 2 ? 'Tirar los dados' : 'Tirar el dado'}
              </button>
            </div>
          ) : needsSustainedRoll ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-emerald-400/70 uppercase tracking-widest">🎯 Desafío sostenido en curso</p>
              <p className="text-xs text-gray-500 text-center">
                {sustainedChallenge.successes}/{sustainedChallenge.successes_needed} éxitos · {sustainedChallenge.failures}/{sustainedChallenge.failures_max + 1} fallos máx
              </p>
              <button
                onClick={rollDice}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                Tirar (1d6 + DC {sustainedChallenge.dc})
              </button>
            </div>
          ) : (
            <>
            {isMyTurn && gameMode === 'combat' && character.ability?.type === 'stat_boost' && !activeCharacterState?.combat_ability_used && (
              <div className="mb-2">
                <StatBoostPanel
                  ability={character.ability}
                  allies={presentedCharacters.filter(c => c.id !== character.id)}
                  onActivate={(ally, stat) => sendAction(`Uso ${character.ability.name}${stat ? ` (+${stat === 'attack' ? 'ATK' : 'DEF'})` : ''} en ${ally.name}`)}
                />
              </div>
            )}
            {isMyTurn && gameMode === 'combat' && character.ability?.type === 'heal' && (
              <div className="mb-2">
                <HealPanel
                  ability={character.ability}
                  allies={presentedCharacters}
                  onActivate={ally => sendAction(`Uso ${character.ability.name} en ${ally.name}`)}
                />
              </div>
            )}
            {isMyTurn && (
              <div className="flex justify-center mb-2">
                <button
                  onClick={() => setActionMode(v => !v)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    actionMode
                      ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}
                >
                  <span>{actionMode ? '⚔️' : '💬'}</span>
                  {actionMode ? 'Acción — el narrador responderá' : 'Conversación — sin narrador'}
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <span className="text-amber-400 font-bold text-sm self-center shrink-0">{character.name}:</span>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isMyTurn && actionMode ? '¿Qué hace tu personaje?' : '¿Qué dice tu personaje?'}
                rows={2}
                disabled={sending}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="px-4 rounded-lg font-bold text-sm bg-amber-400 text-gray-900 hover:bg-amber-300 disabled:bg-gray-800 disabled:text-gray-600 transition-colors shrink-0"
              >
                Enviar
              </button>
            </div>
            </>
          )}
        </div>

      </main>
    </div>
  )
}

export default GameRoom
