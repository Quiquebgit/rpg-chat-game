import { ReactionBar } from './ReactionBar'

export function NarratorMessage({ content, messageId, reactions, onReact }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-gold-dim/60">Narrador</span>
      <div className="bg-panel border border-gold/20 rounded-xl px-5 py-3 max-w-2xl text-center">
        <p className="text-sm text-ink-2 leading-relaxed italic">{content}</p>
      </div>
      {onReact && (
        <ReactionBar reactions={reactions} onReact={(emoji) => onReact(messageId, emoji)} />
      )}
    </div>
  )
}

// Mensaje del NPC durante negociación — estilo diferenciado (tono esmeralda, nombre del NPC)
export function NpcMessage({ name, content }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-stat-navigation/70">{name}</span>
      <div className="bg-panel border border-stat-navigation/25 rounded-xl px-5 py-3 max-w-2xl text-center">
        <p className="text-sm text-ink-2 leading-relaxed">{content}</p>
      </div>
    </div>
  )
}

export function NarratorTyping() {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-gold-dim/60">Narrador</span>
      <div className="bg-panel border border-gold/20 rounded-xl px-5 py-3 flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-gold-dim/70">Narrando</span>
        <div className="flex gap-1 items-center">
          {[0, 0.2, 0.4].map((delay, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gold"
              style={{ animation: `dot-bounce 1.2s ease-in-out ${delay}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
