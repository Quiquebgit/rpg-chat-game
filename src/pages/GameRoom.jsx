import { useState } from 'react'

// Mensajes de ejemplo para visualizar el diseño
const MOCK_MESSAGES = [
  {
    id: 1,
    type: 'narrator',
    character_id: 'narrator',
    content: 'El viento azota las velas del Marea Roja mientras os aproximáis a la isla de Kael. Desde la cofa, Lissa divisa una columna de humo negro en el puerto. Algo no va bien. ¿Qué hacéis, Darro?'
  },
  {
    id: 2,
    type: 'player',
    character_id: 'darro',
    characterName: 'Darro',
    content: 'Ordeno bajar las velas a media asta y acercarnos con cautela. Le digo a Crann que se suba a la cofa con la ballesta lista.'
  },
  {
    id: 3,
    type: 'narrator',
    character_id: 'narrator',
    content: 'Crann asiente y trepa ágilmente. Desde arriba, describe tres barcos hundidos y siluetas moviéndose entre los restos. Parecen soldados marinos. El puerto está tomado.'
  },
  {
    id: 4,
    type: 'player',
    character_id: 'shin',
    characterName: 'Shin',
    content: 'Me apoyo en la borda y desenvuelvo la espada. Si son marinos, ya saben que estamos aquí.'
  },
]

function GameRoom({ character }) {
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const [input, setInput] = useState('')

  function handleSend() {
    const text = input.trim()
    if (!text) return

    setMessages(prev => [...prev, {
      id: prev.length + 1,
      type: 'player',
      character_id: character.id,
      characterName: character.name,
      content: text,
    }])
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* Panel lateral — personaje activo */}
      <aside className="w-72 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col p-5 gap-6">

        {/* Identidad */}
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Jugando como</p>
          <h2 className="text-2xl font-bold text-amber-300">{character.name}</h2>
          <p className="text-sm text-gray-400 uppercase tracking-widest">{character.role}</p>
          <p className="text-xs text-gray-600 italic mt-1">{character.combatStyle}</p>
        </div>

        {/* Vida */}
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Vida</p>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: character.hp }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 w-3 bg-red-500 shrink-0 rotate-45"
                  style={{ clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)' }}
                />
              ))}
            </div>
            <span className="text-sm font-bold text-red-400">{character.hp}/{character.hp}</span>
          </div>
        </div>

        {/* Stats */}
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Stats</p>
          <div className="flex flex-col gap-3">
            <StatRow icon="⚔️" label="Ataque" value={character.attack} color="bg-amber-400" />
            <StatRow icon="🛡️" label="Defensa" value={character.defense} color="bg-blue-400" />
            <StatRow icon="🧭" label="Navegación" value={character.navigation} color="bg-green-400" />
          </div>
        </div>

        {/* Habilidad especial */}
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
          <p className="text-xs uppercase tracking-widest text-amber-500/70 mb-1">Habilidad especial</p>
          <p className="text-sm font-bold text-amber-300 mb-1">✦ {character.ability.name}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{character.ability.description}</p>
        </div>

        {/* Inventario */}
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Inventario</p>
          <p className="text-xs text-gray-600 italic">Sin objetos</p>
        </div>

      </aside>

      {/* Área principal de chat */}
      <main className="flex flex-col flex-1 min-w-0">

        {/* Cabecera */}
        <header className="border-b border-gray-800 px-6 py-4 shrink-0">
          <h1 className="text-lg font-bold text-amber-300">⚓ La aventura comienza</h1>
          <p className="text-xs text-gray-500">Sesión activa</p>
        </header>

        {/* Lista de mensajes */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {messages.map(msg => (
            msg.type === 'narrator'
              ? <NarratorMessage key={msg.id} content={msg.content} />
              : <PlayerMessage key={msg.id} name={msg.characterName} content={msg.content} isOwn={msg.character_id === character.id} />
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 px-6 py-4 shrink-0">
          <div className="flex gap-3">
            <span className="text-amber-400 font-bold text-sm self-center shrink-0">{character.name}:</span>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="¿Qué hace tu personaje?"
              rows={2}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 rounded-lg font-bold text-sm bg-amber-400 text-gray-900 hover:bg-amber-300 disabled:bg-gray-800 disabled:text-gray-600 transition-colors shrink-0"
            >
              Enviar
            </button>
          </div>
          <p className="text-xs text-gray-700 mt-2">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>

      </main>
    </div>
  )
}

// Mensaje del narrador — destacado, centrado, distinto
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

// Mensaje de jugador — alineado según si es propio o de otro
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

// Stat en el panel lateral con puntos de color
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
