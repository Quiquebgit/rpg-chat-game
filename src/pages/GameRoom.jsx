import { useState, useEffect, useRef } from 'react'
import { useMessages } from '../hooks/useMessages'
import { usePresence } from '../hooks/usePresence'
import { useNarration } from '../hooks/useNarration'
import { useDirector } from '../hooks/useDirector'
import { characters as allCharacters } from '../data/characters'
import { MODE_SHADOW, XP_CONFIG, UPGRADABLE_STATS, STAT_LABELS, TITLES_CATALOG } from '../data/constants'
import GameModePanel from '../components/GameModePanel'
import { NarratorMessage, NarratorTyping, NpcMessage } from '../components/NarratorMessage'
import { ActionMessage, OocMessage, GmMessage, PlayerMessage } from '../components/ChatMessages'
import { DiceMessage } from '../components/DiceMessage'
import { PreGameScreen } from '../components/PreGameScreen'
import { StatBoostPanel, HealPanel } from '../components/StatBoostPanel'
import { CharacterPanel } from '../components/CharacterPanel'
import ThemeToggle from '../components/ThemeToggle'
import FamilyModeToggle from '../components/FamilyModeToggle'
import { useTurnNotification } from '../hooks/useTurnNotification'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { useReactions } from '../hooks/useReactions'
import { SpectatorSuggestInput } from '../components/SpectatorSuggestInput'
import { SuggestionPills } from '../components/SuggestionPills'
import { SessionRecapModal } from '../components/SessionRecapModal'
import ContinuePicker from '../components/ContinuePicker'
import BitacoraPanel from '../components/BitacoraPanel'
import { getWorldNpcs, getWorldLocations, getWorldConnections } from '../lib/worldState'
import { supabase } from '../lib/supabase'

function GameRoom({ character, session, onLeave, onSelectCharacter, onContinueWithCrew, onContinueInline, familyMode, toggleFamilyMode }) {
  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [bitacoraOpen, setBitacoraOpen] = useState(false)
  const [continuePickerOpen, setContinuePickerOpen] = useState(false)
  const [worldNpcs, setWorldNpcs] = useState([])
  const [worldLocations, setWorldLocations] = useState([])
  const [worldConnections, setWorldConnections] = useState([])
  const [actionMode, setActionMode] = useState(true)
  const [useNavAbility, setUseNavAbility] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastNarratedIdRef = useRef(null)

  const { presentIds, participantIds, isParticipant, broadcastGameStart, markAsParticipant, spectatorSuggestions, sendSuggestion, dismissSuggestion, clearSuggestions } = usePresence(session, character)
  const { completeCurrentEvent, currentEventSetup } = useDirector(session)
  const { messages, sending, narratorTyping, sendMessage, sendChat, sendAction, sendGmMessage, diceRequest, rollDice, rollInitiative, rollNavigation, sacrificeForNavigation, riskyMove, turnBack, characterStates, gameMode, gameModeData, startGame, announceEntry, debugAddItem, useItem, giftItem, killCharacter, explorationNodeId, navigateExplorationNode, applyStatUpgrade, buyItem, setGameModeDirect } = useMessages(session, character, presentIds, completeCurrentEvent, currentEventSetup)
  const { speak, stop, isNarrating, isEnabled: narrationEnabled, toggle: toggleNarration, error: narrationError, supported: narrationSupported } = useNarration()
  const { reactionsByMessage, toggleReaction } = useReactions(session?.id)

  // Parar la narración al salir de GameRoom (desmontaje) o al ocultar la pestaña
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      stop()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar y suscribir datos del mundo persistente de esta sesión
  useEffect(() => {
    if (!session?.id) return
    async function loadWorld() {
      const [npcs, locs, conns] = await Promise.all([
        getWorldNpcs(session.id),
        getWorldLocations(session.id),
        getWorldConnections(session.id),
      ])
      setWorldNpcs(npcs)
      setWorldLocations(locs)
      setWorldConnections(conns)
    }
    loadWorld()

    // Realtime: actualizar NPCs cuando el director los guarda
    const sub = supabase
      .channel(`world-npcs-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'world_npcs', filter: `session_id=eq.${session.id}` },
        () => getWorldNpcs(session.id).then(setWorldNpcs)
      )
      .subscribe()

    return () => sub.unsubscribe()
  }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const currentBounty = activeCharacterState?.bounty_current ?? null
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

  // Flash de color al cambiar de modo de juego — usa variables CSS para soporte de tema
  const [modeFlashColor, setModeFlashColor] = useState(null)
  const prevGameModeRef = useRef(gameMode)
  useEffect(() => {
    if (prevGameModeRef.current !== gameMode && gameMode !== 'normal') {
      const colors = {
        combat:      'var(--mode-combat-flash)',
        navigation:  'var(--mode-navigation-flash)',
        exploration: 'var(--mode-exploration-flash)',
        negotiation: 'var(--mode-negotiation-flash)',
      }
      setModeFlashColor(colors[gameMode] || null)
      setTimeout(() => setModeFlashColor(null), 700)
    }
    prevGameModeRef.current = gameMode
  }, [gameMode])

  // ¿Es el turno de este jugador?
  const currentTurnName = allCharacters.find(c => c.id === session?.current_turn_character_id)?.name
  const isMyTurn = session?.current_turn_character_id === character.id && !isDead
  useTurnNotification(isMyTurn, character?.name)

  // Limpiar sugerencias de espectadores al cambiar de turno
  useEffect(() => { clearSuggestions() }, [session?.current_turn_character_id])

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

    if (!familyMode && text === '/gm') {
      setShowGmModeSelector(true)
    } else if (!familyMode && text.startsWith('/gm ')) {
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
      className="flex h-screen bg-canvas text-ink overflow-hidden transition-shadow duration-700"
      style={gameMode !== 'normal' ? { boxShadow: MODE_SHADOW[gameMode] } : undefined}
    >

      {/* Flash de transición entre modos de juego */}
      {modeFlashColor && (
        <div
          className="fixed inset-0 pointer-events-none z-30"
          style={{ background: modeFlashColor, animation: 'mode-flash 0.7s ease-out forwards' }}
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
        w-64 bg-panel border-l border-stroke flex flex-col py-6 gap-2
        transition-transform duration-300 ease-in-out
        ${menuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-5 mb-4">
          <span className="text-xs uppercase tracking-widest text-ink-3">Menú</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-1 rounded text-ink-3 hover:text-ink transition-colors"
            aria-label="Cerrar menú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Ajustes */}
        <div className="px-5 py-3 border-b border-stroke">
          <p className="text-xs uppercase tracking-widest text-ink-off mb-3">Ajustes</p>
          {narrationSupported && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-ink-2">Narración por voz</span>
              <button
                onClick={toggleNarration}
                className={`text-lg leading-none ${narrationEnabled ? 'text-gold' : 'text-ink-3'}`}
                title={narrationEnabled ? 'Desactivar' : 'Activar'}
              >
                {narrationEnabled ? (isNarrating ? '🔊' : '🔈') : '🔇'}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-ink-2">Tema visual</span>
            <ThemeToggle />
          </div>
          {toggleFamilyMode && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-ink-2">{familyMode ? 'Modo sencillo' : 'Modo avanzado'}</span>
              <FamilyModeToggle familyMode={familyMode} onToggle={toggleFamilyMode} />
            </div>
          )}
        </div>
        {/* Navegación */}
        <button
          onClick={() => { setMenuOpen(false); onLeave() }}
          className="w-full text-left px-5 py-3 text-sm text-ink-2 hover:bg-raised transition-colors"
        >
          Pantalla de inicio
        </button>
        <button
          onClick={() => { setMenuOpen(false); onSelectCharacter() }}
          className="w-full text-left px-5 py-3 text-sm text-ink-2 hover:bg-raised transition-colors"
        >
          Selección de personaje
        </button>
      </nav>

      <CharacterPanel
        character={character}
        isDead={isDead}
        hasFruit={hasFruit}
        fruitFlash={fruitFlash}
        equippedFruit={equippedFruit}
        hpCurrent={hpCurrent}
        equipmentBonuses={equipmentBonuses}
        combatBoosts={combatBoosts}
        statUpgrades={statUpgrades}
        currentMoney={currentMoney}
        currentXp={currentXp}
        xpProgress={xpProgress}
        gameMode={gameMode}
        inventory={inventory}
        isMyTurn={isMyTurn}
        presentedCharacters={presentedCharacters}
        onUseItem={(item, i) => item.type === 'fruta' && !item.equipped ? setFruitConfirmItem({ item, i }) : useItem(item, i)}
        onGiftItem={giftItem}
        onDebugAddItem={import.meta.env.DEV ? debugAddItem : null}
        familyMode={familyMode}
        currentBounty={currentBounty}
      />

      {/* Modal de stat-up por XP */}
      {myStatUpPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-gold/40 bg-canvas p-6 flex flex-col gap-4 shadow-2xl shadow-gold/20">
            <div className="text-center">
              <p className="text-4xl mb-3">⭐</p>
              <h3 className="text-xl font-bold text-gold-bright">¡Has subido de nivel!</h3>
              <p className="text-sm text-ink-2 mt-2">Elige una estadística para mejorar en +1:</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {UPGRADABLE_STATS.map(stat => (
                <button
                  key={stat}
                  onClick={() => applyStatUpgrade(character.id, stat)}
                  className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-medium text-gold-bright hover:bg-gold/20 transition-colors"
                >
                  {STAT_LABELS[stat] ?? stat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de fin de aventura con recap */}
      {session.status === 'finished' && !continuePickerOpen && (
        <SessionRecapModal
          recap={session.session_recap}
          onContinue={onContinueInline ? () => setContinuePickerOpen(true) : null}
          onLeave={onLeave}
        />
      )}

      {/* Picker inline de historia+dificultad para continuar sin salir */}
      {continuePickerOpen && (
        <ContinuePicker
          onConfirm={(story, template) => onContinueInline(session, story, template)}
          onCancel={() => setContinuePickerOpen(false)}
        />
      )}

      {/* Bitácora del mundo: NPCs y mapa de la sesión */}
      <BitacoraPanel
        open={bitacoraOpen}
        onClose={() => setBitacoraOpen(false)}
        npcs={worldNpcs}
        locations={worldLocations}
        connections={worldConnections}
        characterStates={characterStates}
        presentedCharacters={presentedCharacters}
        session={session}
        currentMoney={currentMoney}
        onBuyItem={buyItem}
      />

      {/* Modal confirmación fruta del diablo */}
      {fruitConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-item-fruta/40 bg-canvas p-6 flex flex-col gap-4 shadow-2xl shadow-item-fruta/20">
            <div className="text-center">
              <p className="text-4xl mb-3">🍎</p>
              <h3 className="text-lg font-bold text-item-fruta mb-2">¿Comer la fruta del diablo?</h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Ganarás poderes extraordinarios al comerla. Esta decisión es <span className="text-item-fruta font-semibold">irreversible</span>.
              </p>
              <p className="text-xs text-ink-off mt-2 italic">"{fruitConfirmItem.item.name}"</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFruitConfirmItem(null)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-raised text-ink-2 hover:bg-float transition-colors"
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
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-item-fruta text-canvas hover:bg-item-fruta/80 transition-colors"
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
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-combat/60 bg-canvas p-6 flex flex-col gap-4 shadow-2xl shadow-combat/30">
            <div className="text-center">
              <p className="text-4xl mb-3">💀</p>
              <h3 className="text-lg font-bold text-combat-light mb-2">Segunda fruta del diablo</h3>
              <p className="text-sm text-ink-2 leading-relaxed">
                Si consumes una segunda fruta del diablo, <span className="text-combat-light font-bold">morirás</span>. ¿Estás seguro?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFruitDeathConfirm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-raised text-ink-2 hover:bg-float transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { killCharacter(character.id); setFruitDeathConfirm(false) }}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-combat text-canvas hover:bg-combat-light transition-colors"
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
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-gold/30 bg-canvas p-6 flex flex-col gap-4 shadow-2xl">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-gold-dim/60 mb-1">GM</p>
              <h3 className="text-lg font-bold text-gold-bright">Cambiar modo de juego</h3>
              <p className="text-xs text-ink-off mt-1">Sin pasar por el modelo — efecto inmediato</p>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { mode: 'normal',      label: '⚓ Normal',       cls: 'border-stroke-3 text-ink-2 hover:bg-raised' },
                { mode: 'combat',      label: '⚔️ Combate',      cls: 'border-combat/40 text-combat-light hover:bg-combat/10' },
                { mode: 'navigation',  label: '🌊 Navegación',   cls: 'border-navigation/40 text-navigation-light hover:bg-navigation/10' },
                { mode: 'exploration', label: '🗺️ Exploración',  cls: 'border-exploration/40 text-exploration-light hover:bg-exploration/10' },
                { mode: 'negotiation', label: '💬 Negociación',  cls: 'border-negotiation/40 text-negotiation-light hover:bg-negotiation/10' },
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
              className="text-xs text-ink-off hover:text-ink-2 transition-colors text-center"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Área principal de chat */}
      <main className="flex flex-col flex-1 min-w-0">

        <header className="border-b border-stroke px-6 py-4 shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gold-bright">⚓ La aventura comienza</h1>
            <p className="text-xs text-ink-off mt-0.5">Sesión activa</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón jugadores conectados */}
            <div className="relative">
              <button
                onClick={() => setPlayersOpen(v => !v)}
                className="relative p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-raised transition-colors"
                aria-label="Jugadores en sala"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                {presentedCharacters.length > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs bg-gold text-canvas rounded-full w-4 h-4 flex items-center justify-center font-black leading-none">
                    {presentedCharacters.length}
                  </span>
                )}
              </button>
              {playersOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-float border border-stroke rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-2 border-b border-stroke">
                    <p className="text-xs uppercase tracking-widest text-ink-3">En la sala</p>
                  </div>
                  {presentedCharacters.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-ink-off italic">Nadie conectado</p>
                  ) : (
                    presentedCharacters.map(c => {
                      const isP = participantIds.includes(c.id)
                      return (
                        <div key={c.id} className="px-4 py-2.5 flex items-center gap-2">
                          <span className={`text-xs ${isP ? 'text-exploration-light' : 'text-ink-off'}`}>
                            {isP ? '●' : '👁'}
                          </span>
                          <div>
                            <p className={`text-sm font-medium ${isP ? 'text-ink' : 'text-ink-3'}`}>{c.name}</p>
                            <p className="text-xs text-ink-off">{isP ? c.role : 'espectador'}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* Copiar enlace de invitación */}
            <CopyLinkButton sessionId={session.id} />

            {/* Bitácora del mundo */}
            <button
              onClick={() => setBitacoraOpen(v => !v)}
              className="p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-raised transition-colors"
              aria-label="Bitácora"
              title="Bitácora del mundo"
            >
              📖
            </button>

            {/* Botón hamburguesa */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-raised transition-colors"
              aria-label="Menú"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </header>

        {narrationError && (
          <div className="shrink-0 px-6 py-2 bg-gold/10 border-b border-gold/20 flex items-center gap-2">
            <span className="text-xs text-gold/80">🔇 {narrationError}</span>
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
          familyMode={familyMode}
          characters={presentedCharacters}
          suppliesDays={session?.supplies_days ?? null}
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
              const msgReactions = reactionsByMessage[msg.id]
              if (msg.type === 'narrator' && msg.character_id !== 'narrator') {
                return <NpcMessage key={msg.id} name={msg.character_id} content={msg.content} messageId={msg.id} reactions={msgReactions} onReact={toggleReaction} />
              }
              if (msg.type === 'narrator') {
                return (
                  <div key={msg.id} className="flex flex-col items-center gap-2">
                    <NarratorMessage
                      content={msg.content}
                      messageId={msg.id}
                      reactions={msgReactions}
                      onReact={toggleReaction}
                    />
                  </div>
                )
              }
              if (msg.type === 'dice') {
                return (
                  <DiceMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                    familyMode={familyMode}
                    messageId={msg.id}
                    reactions={msgReactions}
                    onReact={toggleReaction}
                  />
                )
              }
              if (msg.type === 'action') {
                return (
                  <ActionMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                    messageId={msg.id}
                    reactions={msgReactions}
                    onReact={toggleReaction}
                  />
                )
              }
              if (msg.type === 'gm') {
                return (
                  <GmMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                    messageId={msg.id}
                    reactions={msgReactions}
                    onReact={toggleReaction}
                  />
                )
              }
              if (msg.type === 'ooc') {
                return (
                  <OocMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                    messageId={msg.id}
                    reactions={msgReactions}
                    onReact={toggleReaction}
                  />
                )
              }
              (() => {
                const senderState = characterStates.find(s => s.character_id === msg.character_id)
                const senderTitles = senderState?.titles || []
                const latestTitle = senderTitles.length > 0
                  ? TITLES_CATALOG.find(t => t.id === senderTitles[senderTitles.length - 1])?.label
                  : null
                return (
                  <PlayerMessage
                    key={msg.id}
                    name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                    content={msg.content}
                    isOwn={msg.character_id === character.id}
                    messageId={msg.id}
                    reactions={msgReactions}
                    onReact={toggleReaction}
                    latestTitle={latestTitle}
                  />
                )
              })()
          })}
          {narratorTyping && <NarratorTyping />}
          <div ref={messagesEndRef} />
        </div>

        {/* Indicador de turno — solo para participantes */}
        {!sending && !isSpectator && currentTurnName && (
          <div className={`px-6 py-2 shrink-0 flex items-center justify-center gap-2 border-t ${
            isMyTurn
              ? 'border-gold/30 bg-gold/10'
              : 'border-stroke bg-transparent'
          }`}>
            {isMyTurn ? (
              <p className="text-sm font-bold text-gold-bright tracking-wide">⚔️ Es tu turno, {character.name}</p>
            ) : (
              <p className="text-xs text-ink-3">Turno de <span className="text-ink font-semibold">{currentTurnName}</span></p>
            )}
          </div>
        )}

        {/* Input / Botón de dados / Espectador / Iniciativa / Muerte */}
        <div className="border-t border-stroke px-6 py-4 shrink-0">
          {isDead ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-center text-combat-light/60 uppercase tracking-widest">☠️ Tu personaje está fuera de combate</p>
              <div className="flex gap-3">
                <span className="text-ink-3 font-bold text-sm self-center shrink-0">{character.name}:</span>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Puedes hablar, pero no actuar..."
                  rows={2}
                  disabled={sending}
                  className="flex-1 bg-panel border border-stroke text-ink-3 placeholder-ink-off rounded-lg px-4 py-2 text-sm resize-none focus:outline-none"
                />
                <button
                  onClick={() => { sendChat(input); setInput('') }}
                  disabled={!input.trim() || sending}
                  className="px-4 rounded-lg font-bold text-sm bg-raised text-ink-3 hover:bg-float disabled:opacity-40 transition-colors shrink-0"
                >
                  Enviar
                </button>
              </div>
            </div>
          ) : isSpectator ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-ink-off uppercase tracking-widest">Estás viendo la partida como espectador</p>
              <SpectatorSuggestInput onSend={sendSuggestion} />
              <button
                onClick={handleAnnounceEntry}
                disabled={sending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-raised border border-gold/30 text-gold-bright hover:bg-float hover:border-gold/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>🚪</span>
                Unirme a la aventura
              </button>
            </div>
          ) : needsNavigationRoll ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-navigation-light/70 uppercase tracking-widest">🌊 Navegación — tira tus dados</p>
              {navBonusAvailable && (
                <button
                  onClick={() => setUseNavAbility(v => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    useNavAbility
                      ? 'bg-navigation/20 border-navigation/50 text-navigation-light'
                      : 'bg-raised border-stroke-3 text-ink-3'
                  }`}
                >
                  <span>{useNavAbility ? '✓' : '○'}</span>
                  {navBonusAbility.name} (+{navBonusAbility.effect?.value ?? navBonusAbility.value ?? 0}) — una vez por sesión
                </button>
              )}
              <button
                onClick={() => { rollNavigation(useNavAbility); setUseNavAbility(false) }}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-navigation text-canvas hover:bg-navigation-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                Tirar navegación ({currentEventSetup?.dice_count === 2 ? '2d6' : '1d6'} + {effectiveNav} NAV{useNavAbility ? ' +3' : ''})
              </button>
            </div>
          ) : needsInitiativeRoll ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-combat-light/70 uppercase tracking-widest">⚔️ ¡Combate! Tira tu iniciativa</p>
              <button
                onClick={rollInitiative}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-combat text-canvas hover:bg-combat-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                Tirar iniciativa (1d6 + {effectiveAtk} ATK)
              </button>
            </div>
          ) : gameMode === 'combat' && gameModeData?.combat_turn_order && !gameModeData.initiative?.[character.id] && !isSpectator && !isDead ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-xs text-combat-light/50 uppercase tracking-widest">⚔️ El combate ya ha comenzado</p>
              <p className="text-xs text-ink-off text-center">No puedes unirte a este combate. Espera al siguiente encuentro.</p>
            </div>
          ) : diceRequest.required && isMyTurn ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-gold/70 uppercase tracking-widest">El narrador pide una tirada</p>
              <button
                onClick={rollDice}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-gold text-canvas hover:bg-gold-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                {diceRequest.count === 2 ? 'Tirar los dados' : 'Tirar el dado'}
              </button>
            </div>
          ) : needsSustainedRoll ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-exploration-light/70 uppercase tracking-widest">🎯 Desafío sostenido en curso</p>
              <p className="text-xs text-ink-3 text-center">
                {sustainedChallenge.successes}/{sustainedChallenge.successes_needed} éxitos · {sustainedChallenge.failures}/{sustainedChallenge.failures_max + 1} fallos máx
              </p>
              <button
                onClick={rollDice}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-stat-navigation text-canvas hover:bg-exploration-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            {isMyTurn && spectatorSuggestions.length > 0 && (
              <SuggestionPills suggestions={spectatorSuggestions} onDismiss={dismissSuggestion} />
            )}
            {isMyTurn && !familyMode && (
              <div className="flex justify-center mb-2">
                <button
                  onClick={() => setActionMode(v => !v)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    actionMode
                      ? 'bg-gold/15 border-gold/40 text-gold-bright'
                      : 'bg-raised border-stroke-3 text-ink-3'
                  }`}
                >
                  <span>{actionMode ? '⚔️' : '💬'}</span>
                  {actionMode ? 'Acción — el narrador responderá' : 'Conversación — sin narrador'}
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <span className="text-gold font-bold text-sm self-center shrink-0">{character.name}:</span>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isMyTurn && actionMode ? '¿Qué hace tu personaje?' : '¿Qué dice tu personaje?'}
                rows={2}
                disabled={sending}
                className="flex-1 bg-panel border border-stroke-3 rounded-lg px-4 py-2 text-sm text-ink placeholder-ink-3 resize-none focus:outline-none focus:border-gold disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="px-4 rounded-lg font-bold text-sm bg-gold text-canvas hover:bg-gold-bright disabled:bg-raised disabled:text-ink-off transition-colors shrink-0"
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
