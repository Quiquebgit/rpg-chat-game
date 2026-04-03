// Constantes compartidas entre componentes de UI

// Vignette de fondo según modo de juego (box-shadow inset) — usa tokens CSS para soporte de tema
export const MODE_SHADOW = {
  combat:      'var(--mode-combat-shadow)',
  navigation:  'var(--mode-navigation-shadow)',
  exploration: 'var(--mode-exploration-shadow)',
  negotiation: 'var(--mode-negotiation-shadow)',
}

// Emojis de dado para DiceMessage
export const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

// Estilos de items por tipo — usa tokens de tema
export const ITEM_TYPE_STYLES = {
  fruta:      { bg: 'bg-item-fruta/10',      border: 'border-item-fruta/30',      text: 'text-item-fruta',      icon: '🍎' },
  arma:       { bg: 'bg-item-arma/10',       border: 'border-item-arma/30',       text: 'text-item-arma',       icon: '⚔️' },
  equipo:     { bg: 'bg-item-equipo/10',     border: 'border-item-equipo/30',     text: 'text-item-equipo',     icon: '🎒' },
  consumible: { bg: 'bg-item-consumible/10', border: 'border-item-consumible/30', text: 'text-item-consumible', icon: '🧪' },
}

// Clases de color por rareza de item
export const ITEM_RARITY_STYLES = {
  único:  'text-gold-bright',
  raro:   'text-item-fruta',
  común:  'text-ink-3',
}

// Etiquetas legibles de stats
export const STAT_LABELS = { attack: 'Ataque', defense: 'Defensa', navigation: 'Navegación', dexterity: 'Destreza', charisma: 'Carisma', hp: 'Vida', ability: 'Habilidad' }

// Iconos de stats para el panel de personaje
export const STAT_ICONS = {
  hp:         '❤️',
  attack:     '⚔️',
  defense:    '🛡️',
  navigation: '⚓',
  dexterity:  '🎯',
  charisma:   '💬',
}

// Colores de stats (clase Tailwind bg-*) — usa tokens de tema
export const STAT_COLORS = {
  attack:     'bg-stat-attack',
  defense:    'bg-stat-defense',
  navigation: 'bg-stat-navigation',
  dexterity:  'bg-stat-dexterity',
  charisma:   'bg-stat-charisma',
}

// Textos de grado de éxito en tiradas — usa tokens de tema
export const DEGREE_LABELS = {
  critical_success: { label: '⚡ ¡CRÍTICO!',    className: 'text-degree-crit-success text-2xl font-black' },
  success:          { label: '✓ Éxito',          className: 'text-degree-success text-xl font-bold' },
  failure:          { label: '✗ Fallo',           className: 'text-degree-failure text-xl font-bold' },
  critical_failure: { label: '💀 ¡CATÁSTROFE!',  className: 'text-degree-crit-failure text-2xl font-black' },
}

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
  hostile:  { label: 'Hostil',    color: 'text-combat-light',      bg: 'bg-combat/10',      border: 'border-combat/30' },
  neutral:  { label: 'Neutral',   color: 'text-ink-2',             bg: 'bg-raised',          border: 'border-stroke-3' },
  friendly: { label: 'Amistoso',  color: 'text-exploration-light', bg: 'bg-exploration/10', border: 'border-exploration/30' },
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
  active:    { label: 'Activa',    style: 'text-exploration-light bg-exploration/10 border-exploration/30' },
  finished:  { label: 'Terminada', style: 'text-navigation-light  bg-navigation/10  border-navigation/30' },
  abandoned: { label: 'Archivada', style: 'text-ink-3             bg-raised          border-stroke' },
}

// ── Mundo persistente (Sprint 5) ─────────────────────────────────────────────

// Rangos de la marina y sus etiquetas
export const MARINA_RANKS = {
  fleet_admiral: { label: 'Almirante de Flota', icon: '⭐', tier: 1 },
  admiral:       { label: 'Almirante',          icon: '🎖️', tier: 2 },
  vice_admiral:  { label: 'Vicealmirante',      icon: '⚓', tier: 3 },
  captain:       { label: 'Capitán',            icon: '🚩', tier: 4 },
  commander:     { label: 'Comandante',         icon: '📋', tier: 5 },
  lieutenant:    { label: 'Teniente',           icon: '🔰', tier: 6 },
  other:         { label: 'Otro',               icon: '👤', tier: 7 },
}

// Estilos de facción para NPCs del mundo
export const FACTION_STYLES = {
  marina:   { label: 'Marina',   color: 'text-navigation-light', bg: 'bg-navigation/10', border: 'border-navigation/30' },
  pirata:   { label: 'Pirata',   color: 'text-combat-light',     bg: 'bg-combat/10',     border: 'border-combat/30' },
  gobierno: { label: 'Gobierno', color: 'text-gold',             bg: 'bg-gold/10',       border: 'border-gold/30' },
  otro:     { label: 'Otro',     color: 'text-ink-2',            bg: 'bg-raised',        border: 'border-stroke-3' },
}

// Estilos de tipo de ubicación para el mapa
export const LOCATION_TYPE_STYLES = {
  island:   { label: 'Isla',        icon: '🏝️', fill: 'var(--mode-exploration)' },
  port:     { label: 'Puerto',      icon: '⚓',  fill: 'var(--mode-navigation)' },
  fortress: { label: 'Fortaleza',   icon: '🏰', fill: 'var(--mode-combat)' },
  sea_zone: { label: 'Zona marina', icon: '🌊', fill: 'var(--mode-navigation)' },
  landmark: { label: 'Hito',        icon: '📍', fill: 'var(--accent-gold)' },
}

// Estilos de estado de NPCs del mundo
export const NPC_STATUS_STYLES = {
  active:   { label: 'Activo',    color: 'text-exploration-light', dot: 'bg-exploration' },
  defeated: { label: 'Derrotado', color: 'text-ink-off',           dot: 'bg-ink-off' },
  allied:   { label: 'Aliado',    color: 'text-gold-bright',       dot: 'bg-gold' },
  missing:  { label: 'Desaparecido', color: 'text-ink-3',          dot: 'bg-ink-3' },
}
