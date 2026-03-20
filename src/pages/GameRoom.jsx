import { useState, useEffect, useRef } from 'react'
import { getRandomItem } from '../lib/items'
import { useMessages } from '../hooks/useMessages'
import { usePresence } from '../hooks/usePresence'
import { characters as allCharacters } from '../data/characters'
import GameModePanel from '../components/GameModePanel'

function GameRoom({ character, session, onLeave, onSelectCharacter }) {
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [actionMode, setActionMode] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { presentIds, participantIds, isParticipant, broadcastGameStart, markAsParticipant } = usePresence(session, character)
  const { messages, sending, narratorTyping, sendMessage, sendChat, sendAction, sendGmMessage, diceRequest, rollDice, rollInitiative, characterStates, gameMode, gameModeData, startGame, announceEntry, debugAddItem } = useMessages(session, character, presentIds)

  const hasStarted = messages.length > 0
  const isSpectator = hasStarted && !isParticipant
  const presentedCharacters = allCharacters.filter(c => presentIds.includes(c.id))

  // gameMode y gameModeData vienen del hook (actualización inmediata + sync via Realtime)

  // Vignette desde los bordes según modo (box-shadow inset, sin cambiar el fondo)
  const MODE_SHADOW = {
    combat:      'inset 0 0 150px rgba(220, 38, 38, 0.55)',
    navigation:  'inset 0 0 120px rgba(37, 99, 235, 0.22)',
    exploration: 'inset 0 0 120px rgba(22, 163, 74, 0.22)',
    negotiation: 'inset 0 0 120px rgba(217, 119, 6, 0.22)',
  }

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
  const hasFruit = inventory.some(i => i.type === 'fruta')
  const isDead = activeCharacterState?.is_dead ?? false

  // ¿Es el turno de este jugador?
  const currentTurnName = allCharacters.find(c => c.id === session?.current_turn_character_id)?.name
  const isMyTurn = session?.current_turn_character_id === character.id && !isDead

  // Iniciativa pendiente: en combate y este jugador aún no ha tirado
  const needsInitiativeRoll = gameMode === 'combat'
    && gameModeData
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

    if (text.startsWith('/gm ')) {
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
        w-72 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col pr-7 pl-5 py-6 gap-6
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

        <div className={`relative ${isDead ? 'opacity-60' : ''}`}>
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
            <StatRow icon="⚔️" label="Ataque" value={character.attack} color="bg-amber-400" />
            <StatRow icon="🛡️" label="Defensa" value={character.defense} color="bg-blue-400" />
            <StatRow icon="🧭" label="Navegación" value={character.navigation} color="bg-green-400" />
          </div>
        </div>

        <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
          <p className="text-xs uppercase tracking-widest text-amber-500/70 mb-1">Habilidad especial</p>
          <p className="text-sm font-bold text-amber-300 mb-1">✦ {character.ability.name}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{character.ability.description}</p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Inventario</p>
          <div className="flex-1 overflow-y-auto">
            <InventoryPanel inventory={inventory} />
          </div>
          {import.meta.env.DEV && (
            <DebugInventoryButton onAdd={debugAddItem} />
          )}
        </div>

      </aside>

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

        <GameModePanel gameMode={gameMode} gameModeData={gameModeData} currentTurnName={currentTurnName} />

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {!hasStarted && !sending && (
            <PreGameScreen
              presentedCharacters={presentedCharacters}
              onStart={handleStartGame}
              sending={sending}
            />
          )}
          {messages.map((msg, index) => {
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
          ) : needsInitiativeRoll ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-red-400/70 uppercase tracking-widest">⚔️ ¡Combate! Tira tu iniciativa</p>
              <button
                onClick={rollInitiative}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                Tirar iniciativa (1d6 + {character.attack} ATK)
              </button>
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
          ) : (
            <>
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


function NarratorMessage({ content }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-amber-500/60">Narrador</span>
      <div className="bg-gray-900 border border-amber-400/20 rounded-xl px-5 py-3 max-w-2xl text-center">
        <p className="text-sm text-gray-300 leading-relaxed italic">{content}</p>
      </div>
    </div>
  )
}

function NarratorTyping() {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-amber-500/60">Narrador</span>
      <div className="bg-gray-900 border border-amber-400/20 rounded-xl px-5 py-3">
        <span className="text-amber-400/60 animate-pulse text-sm italic">Narrando…</span>
      </div>
    </div>
  )
}

// Emote de acción — /comando
function ActionMessage({ name, content }) {
  return (
    <div className="flex justify-center px-4">
      <p className="text-sm text-gray-500 italic text-center">
        <span className="text-gray-700">✦</span>{' '}
        <span className="text-gray-400 not-italic font-medium">{name}</span>
        {' '}{content}{' '}
        <span className="text-gray-700">✦</span>
      </p>
    </div>
  )
}

// Mensaje fuera de personaje — //mensaje
function OocMessage({ name, content }) {
  return (
    <div className="flex justify-center px-4">
      <p className="text-xs text-gray-600 italic text-center">
        <span className="text-gray-700 not-italic font-medium">{name}</span>
        {' (OOC): '}{content}
      </p>
    </div>
  )
}

// Instrucción al narrador — /gm
function GmMessage({ name, content }) {
  return (
    <div className="flex justify-center px-4">
      <div className="border border-amber-400/20 rounded-lg px-4 py-2 bg-amber-400/5 max-w-lg">
        <p className="text-xs text-amber-500/50 uppercase tracking-widest mb-1">{name} · maestro de juego</p>
        <p className="text-sm text-amber-200/60 italic">{content}</p>
      </div>
    </div>
  )
}

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function DiceMessage({ name, content }) {
  // Intentar parsear el formato estándar "🎲 3 + 5 = 8" o "🎲 4 = 4"
  const raw = content.replace('🎲 ', '')
  const eqIdx = raw.lastIndexOf(' = ')
  let dice = null
  let total = null

  if (eqIdx !== -1) {
    const diceStr = raw.slice(0, eqIdx)
    const parsedDice = diceStr.split(' + ').map(Number)
    const parsedTotal = Number(raw.slice(eqIdx + 3))
    if (!isNaN(parsedTotal) && parsedDice.every(d => !isNaN(d) && d > 0)) {
      dice = parsedDice
      total = parsedTotal
    }
  }

  // Formato no estándar (iniciativa, etc.) — tarjeta simplificada
  if (!dice) {
    return (
      <div className="flex flex-col items-center gap-2 w-full px-4">
        <span className="text-xs uppercase tracking-widest text-amber-500/50">{name} · Tirada</span>
        <div className="bg-gray-900 border border-amber-400/30 rounded-2xl px-8 py-4 flex items-center gap-3">
          <span className="text-3xl">🎲</span>
          <span className="text-lg font-bold text-amber-400">{raw}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full px-4">
      <span className="text-xs uppercase tracking-widest text-amber-500/50">{name} · Tirada de dados</span>
      <div className="bg-gray-900 border border-amber-400/30 rounded-2xl px-10 py-6 flex flex-col items-center gap-5 w-fit">
        {/* Dados con emoji de cara */}
        <div className="flex gap-6 items-center">
          {dice.map((val, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-6xl leading-none" style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.4))' }}>
                {DICE_EMOJI[val]}
              </span>
              <span className="text-xs font-bold text-amber-400/60">{val}</span>
            </div>
          ))}
          {dice.length > 1 && (
            <span className="text-2xl text-gray-600 font-light mb-4">=</span>
          )}
        </div>
        {/* Total */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-gray-600">Total</span>
          <span className="text-6xl font-black text-amber-400 leading-none">{total}</span>
        </div>
      </div>
    </div>
  )
}

function PlayerMessage({ name, content, isOwn }) {
  return (
    <div className={`flex flex-col gap-1 max-w-xl ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="text-xs text-gray-500 px-1">{name}</span>
      <div className={`rounded-xl px-4 py-2 text-sm leading-relaxed ${isOwn ? 'bg-amber-400/10 border border-amber-400/30 text-amber-100' : 'bg-gray-800 border border-gray-700 text-gray-300'}`}>
        {content}
      </div>
    </div>
  )
}

function PreGameScreen({ presentedCharacters, onStart, sending }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-widest text-amber-500/60">La tripulación se reúne</p>
        <h2 className="text-2xl font-bold text-amber-300">La aventura os espera</h2>
        <p className="text-sm text-gray-500 mt-1">Nadie ha zarpado todavía. ¿Listos para partir?</p>
      </div>

      {presentedCharacters.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <p className="text-xs uppercase tracking-widest text-gray-600 text-center mb-1">En la sala</p>
          {presentedCharacters.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
              <span className="text-green-400 text-xs">●</span>
              <div>
                <p className="text-sm font-semibold text-gray-200">{c.name}</p>
                <p className="text-xs text-gray-600">{c.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onStart}
        disabled={sending || presentedCharacters.length === 0}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xl bg-amber-400 text-gray-900 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-400/20"
      >
        <span className="text-3xl">⚓</span>
        ¡Zarpar!
      </button>
    </div>
  )
}

// --- Inventario ---

const ITEM_TYPE_STYLES = {
  fruta:      { bg: 'bg-purple-400/10', border: 'border-purple-400/30', text: 'text-purple-300', icon: '🍎' },
  arma:       { bg: 'bg-red-400/10',    border: 'border-red-400/30',    text: 'text-red-300',    icon: '⚔️' },
  equipo:     { bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   text: 'text-blue-300',   icon: '🎒' },
  consumible: { bg: 'bg-green-400/10',  border: 'border-green-400/30',  text: 'text-green-300',  icon: '🧪' },
}
const ITEM_RARITY_STYLES = {
  único:  'text-amber-400',
  raro:   'text-purple-400',
  común:  'text-gray-600',
}
const STAT_LABELS = { attack: 'Ataque', defense: 'Defensa', navigation: 'Navegación', hp: 'Vida', ability: 'Habilidad' }

function InventoryPanel({ inventory }) {
  const [expanded, setExpanded] = useState(null)
  if (!inventory?.length) return <p className="text-xs text-gray-600 italic">Sin objetos</p>
  return (
    <div className="flex flex-col gap-1.5">
      {inventory.map((item, i) => {
        const style = ITEM_TYPE_STYLES[item.type] || { bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-gray-400', icon: '📦' }
        const rarityClass = ITEM_RARITY_STYLES[item.rarity] || 'text-gray-600'
        const isOpen = expanded === i
        const description = item.effect || item.description
        const hasDetails = description || item.special_ability || item.effects?.length || item.cure_description
        return (
          <button
            key={i}
            onClick={() => hasDetails && setExpanded(isOpen ? null : i)}
            className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${style.bg} ${style.border} ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm leading-none shrink-0">{style.icon}</span>
                <span className={`text-xs font-semibold truncate ${style.text}`}>{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.effects?.map((e, j) => (
                  <span key={j} className={`text-xs font-bold ${e.modifier > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {e.modifier > 0 ? '+' : ''}{e.modifier} {STAT_LABELS[e.stat] || e.stat}
                  </span>
                ))}
                <span className={`text-xs ${rarityClass}`}>{item.rarity || 'común'}</span>
              </div>
            </div>
            {isOpen && hasDetails && (
              <div className="mt-1.5 border-t border-white/10 pt-1.5 flex flex-col gap-1">
                {description && (
                  <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
                )}
                {item.special_ability && (
                  <p className="text-xs text-amber-300/80 leading-relaxed">✦ {item.special_ability}</p>
                )}
                {item.cure_description && (
                  <p className="text-xs text-teal-400/80 leading-relaxed">💊 {item.cure_description}</p>
                )}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Botón de debug solo visible en desarrollo — obtiene item aleatorio real de la BD
const DEBUG_TYPES = ['arma', 'equipo', 'consumible', 'fruta']
let debugCursor = 0

function DebugInventoryButton({ onAdd }) {
  const [loading, setLoading] = useState(false)
  async function handleAdd() {
    setLoading(true)
    const type = DEBUG_TYPES[debugCursor % DEBUG_TYPES.length]
    debugCursor++
    const item = await getRandomItem({ type })
    if (item) onAdd(item)
    setLoading(false)
  }
  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="mt-2 w-full text-xs text-gray-600 border border-dashed border-gray-800 rounded-lg py-1.5 hover:text-gray-400 hover:border-gray-700 disabled:opacity-40 transition-colors"
    >
      {loading ? 'cargando…' : '+ debug: añadir item'}
    </button>
  )
}

function StatRow({ icon, label, value, color }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs text-gray-500">{icon} {label}</p>
        <span className="text-xs font-bold text-gray-400">{value}</span>
      </div>
      <div className="flex gap-1 items-center">
        {Array.from({ length: value }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-3 ${color} shrink-0 rotate-45`}
            style={{ clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)' }}
          />
        ))}
      </div>
    </div>
  )
}

export default GameRoom
