export function NarratorMessage({ content }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-amber-500/60">Narrador</span>
      <div className="bg-gray-900 border border-amber-400/20 rounded-xl px-5 py-3 max-w-2xl text-center">
        <p className="text-sm text-gray-300 leading-relaxed italic">{content}</p>
      </div>
    </div>
  )
}

// Mensaje del NPC durante negociación — estilo diferenciado (tono teal, nombre del NPC)
export function NpcMessage({ name, content }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-teal-500/70">{name}</span>
      <div className="bg-gray-900 border border-teal-400/25 rounded-xl px-5 py-3 max-w-2xl text-center">
        <p className="text-sm text-teal-100/85 leading-relaxed">{content}</p>
      </div>
    </div>
  )
}

export function NarratorTyping() {
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <span className="text-xs uppercase tracking-widest text-amber-500/60">Narrador</span>
      <div className="bg-gray-900 border border-amber-400/20 rounded-xl px-5 py-3 flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-amber-600/70">Narrando</span>
        <div className="flex gap-1 items-center">
          {[0, 0.2, 0.4].map((delay, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              style={{ animation: `dot-bounce 1.2s ease-in-out ${delay}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
