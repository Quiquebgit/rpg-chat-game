// Constantes compartidas entre componentes de UI

// Vignette de fondo según modo de juego (box-shadow inset)
export const MODE_SHADOW = {
  combat:      'inset 0 0 150px rgba(220, 38, 38, 0.55)',
  navigation:  'inset 0 0 120px rgba(37, 99, 235, 0.22)',
  exploration: 'inset 0 0 120px rgba(22, 163, 74, 0.22)',
  negotiation: 'inset 0 0 120px rgba(217, 119, 6, 0.22)',
}

// Emojis de dado para DiceMessage
export const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

// Estilos de items por tipo
export const ITEM_TYPE_STYLES = {
  fruta:      { bg: 'bg-purple-400/10', border: 'border-purple-400/30', text: 'text-purple-300', icon: '🍎' },
  arma:       { bg: 'bg-red-400/10',    border: 'border-red-400/30',    text: 'text-red-300',    icon: '⚔️' },
  equipo:     { bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   text: 'text-blue-300',   icon: '🎒' },
  consumible: { bg: 'bg-green-400/10',  border: 'border-green-400/30',  text: 'text-green-300',  icon: '🧪' },
}

// Clases de color por rareza de item
export const ITEM_RARITY_STYLES = {
  único:  'text-amber-400',
  raro:   'text-purple-400',
  común:  'text-gray-600',
}

// Etiquetas legibles de stats
export const STAT_LABELS = { attack: 'Ataque', defense: 'Defensa', navigation: 'Navegación', hp: 'Vida', ability: 'Habilidad' }

// Estilos de actitud de NPC en modo negociación
export const ATTITUDE_STYLES = {
  hostile:  { label: 'Hostil',    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30' },
  neutral:  { label: 'Neutral',   color: 'text-gray-300',   bg: 'bg-gray-800',      border: 'border-gray-700' },
  friendly: { label: 'Amistoso',  color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30' },
}

// Etiquetas de triggers de habilidades de enemigos
export const ABILITY_TRIGGER_LABELS = {
  hp_below_half: 'Al 50% HP',
  first_turn:    'Primer turno',
  every_turn:    'Cada turno',
  random:        'Aleatorio',
}

// Etiquetas de efectos de habilidades de enemigos
export const ABILITY_EFFECT_LABELS = {
  double_attack: '⚔️⚔️ Doble ataque',
  aoe_attack:    '💥 Ataque en área',
  heal:          '💚 Curación propia',
  stun:          '⚡ Aturde al atacante',
  poison:        '☠️ Veneno',
}

// Estilos y etiquetas de estado de sesión (Lobby)
export const SESSION_STATUS = {
  active:    { label: 'Activa',    style: 'text-green-400 bg-green-400/10 border-green-400/30' },
  finished:  { label: 'Terminada', style: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  abandoned: { label: 'Archivada', style: 'text-gray-500 bg-gray-500/10 border-gray-500/30' },
}
