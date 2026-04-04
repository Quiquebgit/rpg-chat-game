// Toggle entre modo sencillo y modo avanzado.
export default function FamilyModeToggle({ familyMode, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-raised transition-colors"
      title={familyMode ? 'Cambiar a modo avanzado' : 'Cambiar a modo sencillo'}
      aria-label={familyMode ? 'Cambiar a modo avanzado' : 'Cambiar a modo sencillo'}
    >
      <span className="text-lg leading-none">{familyMode ? '⭐' : '👨‍👩‍👧‍👦'}</span>
    </button>
  )
}
