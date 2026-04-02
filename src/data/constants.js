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
export const STAT_LABELS = { attack: 'Ataque', defense: 'Defensa', navigation: 'Navegación', dexterity: 'Destreza', charisma: 'Carisma', hp: 'Vida', ability: 'Habilidad' }

// Configuración de XP y progresión
export const XP_CONFIG = {
  THRESHOLD: 100,        // XP necesario para ganar 1 punto de stat
  CRITICAL_SUCCESS: 25,  // XP por éxito crítico en skill check
  SUCCESS: 10,           // XP por éxito en skill check
  INTERESTING_FAILURE: 5,// XP por fallo interesante
  ENEMY_COMMON: 20,      // XP por enemigo común (hp ≤ 4)
  ENEMY_RARE: 50,        // XP por enemigo raro (hp 5-7)
  ENEMY_UNIQUE: 100,     // XP por enemigo único (hp ≥ 8)
}

// Rangos de recompensa en berries por tipo de enemigo
export const MONEY_CONFIG = {
  ENEMY_COMMON: { min: 20,  max: 50  },
  ENEMY_RARE:   { min: 100, max: 200 },
  ENEMY_UNIQUE: { min: 300, max: 600 },
}

// Stats que un jugador puede subir con XP
export const UPGRADABLE_STATS = ['attack', 'defense', 'navigation', 'dexterity', 'charisma']

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
