import { supabase } from './supabase'

// Rangos de HP por dificultad (coherentes con el sistema de personajes)
const DIFFICULTY_RANGES = {
  easy:   { max: 5 },
  medium: { min: 5, max: 9 },
  hard:   { min: 8, max: 12 },
  boss:   { min: 12 },
}

// Iconos por tipo de enemigo
const TYPE_ICONS = {
  marino:     '⚓',
  pirata:     '☠️',
  criatura:   '🦑',
  animal:     '🐾',
  agente:     '🕵️',
  mercenario: '⚔️',
}

// Tipos DB que corresponden a cada categoría de la tool
const TYPE_FILTERS = {
  humano:    ['marino', 'pirata', 'mercenario', 'agente'],
  criatura:  ['criatura', 'animal'],
  cualquiera: null,  // sin filtro
}

// Obtiene enemigos aleatorios de la tabla según criterios.
// Devuelve array formateado para game_mode_data.enemies.
export async function getEnemies({ difficulty = 'medium', count = 2, type = 'cualquiera' } = {}) {
  const range = DIFFICULTY_RANGES[difficulty] || DIFFICULTY_RANGES.medium

  let query = supabase
    .from('enemies')
    .select('id, name, type, hp, attack, defense, ability, loot_type, loot_table, attack_type')

  if (range.min !== undefined) query = query.gte('hp', range.min)
  if (range.max !== undefined) query = query.lte('hp', range.max)

  const dbTypes = TYPE_FILTERS[type]
  if (dbTypes) query = query.in('type', dbTypes)

  const { data, error } = await query
  if (error || !data?.length) {
    console.warn('[enemies] sin resultados para', { difficulty, type }, '— usando fallback')
    return []
  }

  // Mezcla aleatoria y toma `count` enemigos (máximo 4)
  const selected = [...data]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, 4))

  // Formato para game_mode_data.enemies
  return selected.map((e, i) => ({
    id: `enemy_${i + 1}`,
    db_id: e.id,
    name: e.name,
    type: e.type,
    hp: e.hp,
    hp_max: e.hp,
    attack: e.attack,
    defense: e.defense,
    ability: e.ability || null,
    ability_used: false,
    attack_type: e.attack_type || ['physical'],
    loot_type: e.loot_type,
    loot_table: e.loot_table,
    icon: TYPE_ICONS[e.type] || '👾',
    defeated: false,
  }))
}

// Tool definition para Groq function calling
export const GET_ENEMIES_TOOL = {
  type: 'function',
  function: {
    name: 'getEnemies',
    description:
      'Obtiene enemigos reales de la base de datos para iniciar un combate. ' +
      'DEBES llamar a esta función siempre que vayas a devolver game_mode:"combat". ' +
      'Usa sus resultados en game_mode_data.enemies.',
    parameters: {
      type: 'object',
      properties: {
        difficulty: {
          type: 'string',
          enum: ['easy', 'medium', 'hard', 'boss'],
          description: 'Dificultad: easy=HP≤5, medium=HP 5-9, hard=HP 8-12, boss=HP≥12',
        },
        count: {
          type: 'integer',
          minimum: 1,
          maximum: 4,
          description: 'Número de enemigos (1-4)',
        },
        type: {
          type: 'string',
          enum: ['cualquiera', 'humano', 'criatura'],
          description: 'humano=marines/piratas/mercenarios, criatura=monstruos marinos/animales',
        },
      },
      required: ['difficulty', 'count', 'type'],
    },
  },
}
