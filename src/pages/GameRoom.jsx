import { useState, useEffect, useRef } from 'react'
import { useMessages } from '../hooks/useMessages'
import { usePresence } from '../hooks/usePresence'
import { characters as allCharacters } from '../data/characters'

function GameRoom({ character, session }) {
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)

  const { presentIds } = usePresence(session, character)
  const { messages, sending, sendMessage, sendAction, sendGmMessage, diceRequest, rollDice, characterStates } = useMessages(session, character, presentIds)

  // Estado actual del personaje propio (vida en tiempo real)
  const activeCharacterState = characterStates.find(s => s.character_id === character.id)
  const hpCurrent = activeCharacterState?.hp_current ?? character.hp

  // ¿Es el turno de este jugador?
  const currentTurnName = allCharacters.find(c => c.id === session?.current_turn_character_id)?.name
  const isMyTurn = session?.current_turn_character_id === character.id

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')

    if (text.startsWith('/gm ')) {
      await sendGmMessage(text.slice(4).trim())
    } else if (text.startsWith('/')) {
      await sendAction(text.slice(1).trim())
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
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

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

        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Jugando como</p>
          <h2 className="text-2xl font-bold text-amber-300">{character.name}</h2>
          <p className="text-sm text-gray-400 uppercase tracking-widest">{character.role}</p>
          <p className="text-xs text-gray-600 italic mt-1">{character.combatStyle}</p>
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

        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Inventario</p>
          <p className="text-xs text-gray-600 italic">Sin objetos</p>
        </div>

      </aside>

      {/* Área principal de chat */}
      <main className="flex flex-col flex-1 min-w-0 md:ml-0 ml-7">

        <header className="border-b border-gray-800 px-6 py-4 shrink-0">
          <h1 className="text-lg font-bold text-amber-300">⚓ La aventura comienza</h1>
          <p className="text-xs text-gray-600 mt-0.5">Sesión activa</p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {messages.length === 0 && !sending && (
            <p className="text-center text-gray-700 text-sm italic mt-8">El narrador está preparando la escena…</p>
          )}
          {messages.map((msg, index) => {
            if (msg.type === 'narrator') {
              // Mostrar el indicador de turno solo después del último mensaje del narrador
              const isLast = index === messages.length - 1
              return (
                <div key={msg.id} className="flex flex-col items-center gap-2">
                  <NarratorMessage content={msg.content} />
                  {isLast && !sending && !diceRequest.required && (
                    <TurnIndicator name={currentTurnName} isMe={isMyTurn} />
                  )}
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
            return (
              <PlayerMessage
                key={msg.id}
                name={allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id}
                content={msg.content}
                isOwn={msg.character_id === character.id}
              />
            )
          })}
          {sending && <NarratorTyping />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input / Botón de dados */}
        <div className="border-t border-gray-800 px-6 py-4 shrink-0">
          {diceRequest.required && isMyTurn ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-amber-400/70 uppercase tracking-widest">El narrador pide una tirada</p>
              <button
                onClick={rollDice}
                disabled={sending}
                className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg bg-amber-400 text-gray-900 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-2xl">🎲</span>
                Tirar {diceRequest.count}d6
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <span className="text-amber-400 font-bold text-sm self-center shrink-0">{character.name}:</span>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="¿Qué hace tu personaje?"
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
              <p className="text-xs text-gray-700 mt-2">Enter para enviar · Shift+Enter para nueva línea</p>
            </>
          )}
        </div>

      </main>
    </div>
  )
}

// Indicador de turno — aparece bajo el último mensaje del narrador
function TurnIndicator({ name, isMe }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-gray-800" />
      <p className="text-xs text-gray-500 shrink-0">
        Turno de{' '}
        <span className={`font-bold ${isMe ? 'text-amber-400' : 'text-gray-300'}`}>
          {name}
        </span>
        {isMe && <span className="text-amber-400"> — es tu momento</span>}
      </p>
      <div className="h-px flex-1 bg-gray-800" />
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
  // Parsear "🎲 3 + 5 = 8" o "🎲 4 = 4"
  const raw = content.replace('🎲 ', '')
  const [diceStr, totalStr] = raw.split(' = ')
  const dice = diceStr.split(' + ').map(Number)
  const total = Number(totalStr)

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
