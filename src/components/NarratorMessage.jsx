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
      <div className="bg-gray-900 border border-amber-400/20 rounded-xl px-5 py-3">
        <span className="text-amber-400/60 animate-pulse text-sm italic">Narrando…</span>
      </div>
    </div>
  )
}
