// Toggle entre modo normal y modo familia (UI simplificada).
export function FamilyModeToggle({ familyMode, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-raised transition-colors"
      title={familyMode ? 'Desactivar modo familia' : 'Activar modo familia (UI simplificada)'}
      aria-label={familyMode ? 'Desactivar modo familia' : 'Activar modo familia'}
    >
      <span className="text-lg leading-none">{familyMode ? '🎮' : '👨‍👩‍👧‍👦'}</span>
    </button>
  )
}
