// Mensajes de chat: acción, OOC, GM e input de jugador

export function ActionMessage({ name, content }) {
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
export function OocMessage({ name, content }) {
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
export function GmMessage({ name, content }) {
  return (
    <div className="flex justify-center px-4">
      <div className="border border-amber-400/20 rounded-lg px-4 py-2 bg-amber-400/5 max-w-lg">
        <p className="text-xs text-amber-500/50 uppercase tracking-widest mb-1">{name} · maestro de juego</p>
        <p className="text-sm text-amber-200/60 italic">{content}</p>
      </div>
    </div>
  )
}

export function PlayerMessage({ name, content, isOwn }) {
  return (
    <div className={`flex flex-col gap-1 max-w-xl ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="text-xs text-gray-500 px-1">{name}</span>
      <div className={`rounded-xl px-4 py-2 text-sm leading-relaxed ${isOwn ? 'bg-amber-400/10 border border-amber-400/30 text-amber-100' : 'bg-gray-800 border border-gray-700 text-gray-300'}`}>
        {content}
      </div>
    </div>
  )
}
