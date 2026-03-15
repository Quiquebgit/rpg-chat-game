// Modal que aparece cuando existe una sesión activa al entrar al juego
function SessionModal({ onContinue, onAbandon }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className="text-xl font-bold text-amber-300 mb-2">⚓ Aventura en curso</h2>
        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          Ya hay una sesión activa. ¿Quieres continuar donde lo dejasteis, o abandonarla y empezar una nueva aventura?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onContinue}
            className="w-full py-3 rounded-xl font-bold text-gray-900 bg-amber-400 hover:bg-amber-300 transition-colors"
          >
            Continuar la aventura
          </button>
          <button
            onClick={onAbandon}
            className="w-full py-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Abandonar y empezar nueva
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionModal
