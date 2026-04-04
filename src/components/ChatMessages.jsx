// Mensajes de chat: acción, OOC, GM e input de jugador
import { ReactionAddButton, ReactionPills } from './ReactionBar'

export function ActionMessage({ name, content, messageId, reactions, onReact }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4">
      <div className="relative group">
        <p className="text-sm text-ink-3 italic text-center">
          <span className="text-ink-off">✦</span>{' '}
          <span className="text-ink-2 not-italic font-medium">{name}</span>
          {' '}{content}{' '}
          <span className="text-ink-off">✦</span>
        </p>
        {onReact && (
          <div className="absolute -top-2 -right-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <ReactionAddButton onReact={emoji => onReact(messageId, emoji)} />
          </div>
        )}
      </div>
      {reactions?.length > 0 && (
        <ReactionPills reactions={reactions} onReact={emoji => onReact(messageId, emoji)} />
      )}
    </div>
  )
}

// Mensaje fuera de personaje — //mensaje
export function OocMessage({ name, content, messageId, reactions, onReact }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4">
      <div className="relative group">
        <p className="text-xs text-ink-3 italic text-center">
          <span className="text-ink-off not-italic font-medium">{name}</span>
          {' (OOC): '}{content}
        </p>
        {onReact && (
          <div className="absolute -top-2 -right-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <ReactionAddButton onReact={emoji => onReact(messageId, emoji)} />
          </div>
        )}
      </div>
      {reactions?.length > 0 && (
        <ReactionPills reactions={reactions} onReact={emoji => onReact(messageId, emoji)} />
      )}
    </div>
  )
}

// Instrucción al narrador — /gm
export function GmMessage({ name, content, messageId, reactions, onReact }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4">
      <div className="relative group">
        <div className="border border-gold/20 rounded-lg px-4 py-2 bg-gold/5 max-w-lg">
          <p className="text-xs text-gold-dim/50 uppercase tracking-widest mb-1">{name} · maestro de juego</p>
          <p className="text-sm text-gold-bright/60 italic">{content}</p>
        </div>
        {onReact && (
          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <ReactionAddButton onReact={emoji => onReact(messageId, emoji)} />
          </div>
        )}
      </div>
      {reactions?.length > 0 && (
        <ReactionPills reactions={reactions} onReact={emoji => onReact(messageId, emoji)} />
      )}
    </div>
  )
}

export function PlayerMessage({ name, content, isOwn, messageId, reactions, onReact }) {
  return (
    <div className={`flex flex-col gap-1 max-w-xl ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="text-xs text-ink-3 px-1">{name}</span>
      <div className="relative group">
        <div className={`rounded-xl px-4 py-2 text-sm leading-relaxed ${isOwn ? 'bg-gold/10 border border-gold/30 text-ink' : 'bg-raised border border-stroke-3 text-ink-2'}`}>
          {content}
        </div>
        {onReact && (
          <div className={`absolute -top-2 ${isOwn ? '-left-2' : '-right-2'} opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`}>
            <ReactionAddButton onReact={emoji => onReact(messageId, emoji)} />
          </div>
        )}
      </div>
      {reactions?.length > 0 && (
        <ReactionPills reactions={reactions} onReact={emoji => onReact(messageId, emoji)} />
      )}
    </div>
  )
}
