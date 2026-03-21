import { supabase } from './supabase'

// Definición de la herramienta para el modelo mecánico
export const GET_RANDOM_ITEM_TOOL = {
  type: 'function',
  function: {
    name: 'getRandomItem',
    description: 'Obtiene un item aleatorio del catálogo según tipo y rareza. Usar cuando un personaje encuentre, reciba, compre o sea víctima de un objeto durante la partida.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['arma', 'equipo', 'consumible', 'fruta'],
          description: 'Tipo de item',
        },
        rarity: {
          type: 'string',
          enum: ['común', 'raro', 'único'],
          description: 'Rareza del item. Usar "común" por defecto salvo que la situación justifique algo especial.',
        },
        is_negative: {
          type: 'boolean',
          description: 'true si el item es negativo (veneno, maldición, trampa...)',
        },
      },
      required: ['type'],
    },
  },
}

// Devuelve un item aleatorio de la tabla items según los filtros indicados
export async function getRandomItem({ type, rarity, is_negative } = {}) {
  let query = supabase
    .from('items')
    .select('name, type, rarity, is_negative, description, effects, special_ability, cure_description, target, equippable')

  if (type) query = query.eq('type', type)
  if (rarity) query = query.eq('rarity', rarity)
  if (is_negative !== undefined) query = query.eq('is_negative', is_negative)

  const { data, error } = await query
  if (error || !data?.length) return null

  const item = data[Math.floor(Math.random() * data.length)]
  // Devolver en el formato que espera inventory_updates
  return {
    name: item.name,
    type: item.type,
    rarity: item.rarity,
    effect: item.description,
    effects: item.effects || [],
    special_ability: item.special_ability || null,
    cure_description: item.cure_description || null,
    is_negative: item.is_negative,
    target: item.target || 'any',
    equippable: item.equippable ?? false,
  }
}
