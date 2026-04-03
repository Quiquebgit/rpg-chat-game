// Mensajes de chat: acción, OOC, GM e input de jugador

export function ActionMessage({ name, content }) {
  return (
    <div className="flex justify-center px-4">
      <p className="text-sm text-ink-3 italic text-center">
        <span className="text-ink-off">✦</span>{' '}
        <span className="text-ink-2 not-italic font-medium">{name}</span>
        {' '}{content}{' '}
        <span className="text-ink-off">✦</span>
      </p>
    </div>
  )
}

// Mensaje fuera de personaje — //mensaje
export function OocMessage({ name, content }) {
  return (
    <div className="flex justify-center px-4">
      <p className="text-xs text-ink-3 italic text-center">
        <span className="text-ink-off not-italic font-medium">{name}</span>
        {' (OOC): '}{content}
      </p>
    </div>
  )
}

// Instrucción al narrador — /gm
export function GmMessage({ name, content }) {
  return (
    <div className="flex justify-center px-4">
      <div className="border border-gold/20 rounded-lg px-4 py-2 bg-gold/5 max-w-lg">
        <p className="text-xs text-gold-dim/50 uppercase tracking-widest mb-1">{name} · maestro de juego</p>
        <p className="text-sm text-gold-bright/60 italic">{content}</p>
      </div>
    </div>
  )
}

export function PlayerMessage({ name, content, isOwn }) {
  return (
    <div className={`flex flex-col gap-1 max-w-xl ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="text-xs text-ink-3 px-1">{name}</span>
      <div className={`rounded-xl px-4 py-2 text-sm leading-relaxed ${isOwn ? 'bg-gold/10 border border-gold/30 text-ink' : 'bg-raised border border-stroke-3 text-ink-2'}`}>
        {content}
      </div>
    </div>
  )
}
