import ThemeToggle from '../components/ThemeToggle'

const FEATURES = [
  {
    icon: '🎭',
    title: 'Narrador IA',
    description: 'Una inteligencia artificial narra cada escena, reacciona a tus decisiones y mantiene vivo el mundo.',
  },
  {
    icon: '⚔️',
    title: '4 modos de juego',
    description: 'Combate, navegación, exploración y negociación. Cada situación pide un enfoque diferente.',
  },
  {
    icon: '📈',
    title: 'Progresión real',
    description: 'Sube stats, gana berries, desbloquea títulos y haz crecer el bounty de tu tripulación.',
  },
]

export default function Landing({ onEnter }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--gradient-lobby), var(--bg-base)' }}>
      {/* Header */}
      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center -mt-16">
        <div className="mb-6 opacity-80">
          <img src="/favicon.svg" alt="Grand Line" className="w-20 h-20 mx-auto drop-shadow-lg" />
        </div>
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-black tracking-wide text-gold-bright mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Grand Line RPG
        </h1>
        <p className="text-ink-2 text-lg sm:text-xl max-w-md mb-10 leading-relaxed">
          Juego de rol cooperativo con IA.<br />
          Embárcate en aventuras épicas con tu tripulación.
        </p>
        <button
          onClick={onEnter}
          className="px-8 py-3 rounded-lg bg-gold text-canvas font-bold text-lg
                     hover:opacity-90 transition-opacity cursor-pointer
                     shadow-lg"
        >
          Comenzar aventura
        </button>
      </main>

      {/* Features */}
      <section className="px-4 pb-16 pt-8 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="bg-panel border border-stroke rounded-xl p-5 text-center"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3
                className="text-gold font-bold text-sm mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {f.title}
              </h3>
              <p className="text-ink-3 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-ink-off text-xs pb-6">
        Hecho con React + Supabase + IA
      </footer>
    </div>
  )
}
