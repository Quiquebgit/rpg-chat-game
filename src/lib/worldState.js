import { supabase } from './supabase'
import { callDirectorModel } from './groq'

// ── NPCs del mundo ──────────────────────────────────────────────────────────

// Busca un NPC por nombre exacto (case-insensitive) dentro de una sesión concreta
export async function findWorldNpc(name, sessionId) {
  let query = supabase.from('world_npcs').select('*').ilike('name', name)
  if (sessionId) query = query.eq('session_id', sessionId)
  const { data } = await query.maybeSingle()
  return data
}

// Obtiene NPCs del mundo para una sesión concreta
export async function getWorldNpcs(sessionId, { status, faction, rank } = {}) {
  let query = supabase.from('world_npcs').select('*').eq('session_id', sessionId)
  if (status) query = query.eq('status', status)
  if (faction) query = query.eq('faction', faction)
  if (rank) query = query.eq('rank', rank)
  const { data, error } = await query.order('created_at')
  if (error) {
    console.error('[worldState] Error cargando NPCs:', error)
    return []
  }
  return data || []
}

// Guarda o actualiza un NPC. Si ya existe en esta sesión (por nombre), actualiza; si no, inserta.
export async function saveWorldNpc({ name, rank, faction, hp, attack, defense, description, status, bounty, personality_notes, first_seen_session, session_id }) {
  const existing = await findWorldNpc(name, session_id)
  if (existing) {
    // Actualizar solo campos que vengan definidos
    const updates = {}
    if (description && description !== existing.description) updates.description = description
    if (personality_notes) updates.personality_notes = personality_notes
    if (Object.keys(updates).length === 0) return existing
    const { data } = await supabase
      .from('world_npcs')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()
    return data || existing
  }

  const { data, error } = await supabase
    .from('world_npcs')
    .insert({
      name,
      rank: rank || 'other',
      faction: faction || 'marina',
      hp: hp || 5,
      attack: attack || 3,
      defense: defense || 2,
      description: description || '',
      status: status || 'active',
      bounty: bounty || 0,
      personality_notes: personality_notes || null,
      first_seen_session,
      session_id: session_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[worldState] Error guardando NPC:', error)
    return null
  }
  console.log('[worldState] NPC guardado:', data?.name)
  return data
}

// Marca un NPC como derrotado. No-op si no existe.
export async function defeatWorldNpc(npcName, sessionId) {
  const existing = await findWorldNpc(npcName, sessionId)
  if (!existing || existing.status === 'defeated') return null

  const { data } = await supabase
    .from('world_npcs')
    .update({ status: 'defeated', defeated_in_session: sessionId })
    .eq('id', existing.id)
    .select()
    .single()

  console.log('[worldState] NPC derrotado:', npcName)
  return data
}

// ── Generación de jerarquía Marina ──────────────────────────────────────────

const MARINA_HIERARCHY_PROMPT = `Genera la jerarquía completa de la Marina para un juego de rol en un universo de piratas original. SOLO JSON.

Devuelve un array "npcs" con exactamente estos rangos y cantidades:
- 1 fleet_admiral (HP 15-18, ATK 6-7, DEF 5-6, bounty 500000000+)
- 3 admiral (HP 12-15, ATK 5-6, DEF 4-5, bounty 200000000-400000000)
- 5 vice_admiral (HP 8-12, ATK 4-5, DEF 3-4, bounty 50000000-150000000)
- 7 captain (HP 5-8, ATK 3-4, DEF 2-3, bounty 10000000-40000000)

Cada NPC tiene: name (nombre original en español o japonés inventado), rank, hp, attack, defense, description (1 frase: apariencia + personalidad), bounty, personality_notes (2-3 rasgos de carácter para mantener coherencia).

{"npcs":[{...}]}`

// Genera la jerarquía de la Marina si no existe. Idempotente.
export async function generateMarinaHierarchy(sessionId) {
  const existing = await getWorldNpcs(sessionId, { faction: 'marina' })
  if (existing.length > 0) {
    console.log('[worldState] Marina ya existe, omitiendo generación')
    return existing
  }

  console.log('[worldState] Generando jerarquía de la Marina...')
  try {
    const raw = await callDirectorModel(
      MARINA_HIERARCHY_PROMPT,
      'Genera la jerarquía completa ahora. Nombres originales, no uses nombres de One Piece.'
    )
    if (!raw) {
      console.error('[worldState] Director no devolvió respuesta para Marina')
      return []
    }

    const parsed = JSON.parse(raw)
    const npcs = parsed.npcs || parsed.hierarchy || []
    if (!npcs.length) {
      console.error('[worldState] Director devolvió array vacío para Marina')
      return []
    }

    // Insertar todos los NPCs en paralelo
    const results = await Promise.all(
      npcs.map(npc => saveWorldNpc({
        name: npc.name,
        rank: npc.rank || 'other',
        faction: 'marina',
        hp: npc.hp || 5,
        attack: npc.attack || 3,
        defense: npc.defense || 2,
        description: npc.description || '',
        bounty: npc.bounty || 0,
        personality_notes: npc.personality_notes || '',
        first_seen_session: sessionId,
      }))
    )

    console.log(`[worldState] Marina generada: ${results.filter(Boolean).length} NPCs`)
    return results.filter(Boolean)
  } catch (err) {
    console.error('[worldState] Error generando Marina:', err)
    return []
  }
}

// ── Ubicaciones del mundo ───────────────────────────────────────────────────

// Obtiene las ubicaciones descubiertas en una sesión concreta
export async function getWorldLocations(sessionId) {
  let query = supabase.from('world_locations').select('*')
  if (sessionId) query = query.eq('session_id', sessionId)
  const { data, error } = await query.order('created_at')
  if (error) {
    console.error('[worldState] Error cargando ubicaciones:', error)
    return []
  }
  return data || []
}

// Obtiene conexiones entre ubicaciones de una sesión
export async function getWorldConnections(sessionId) {
  if (!sessionId) {
    const { data, error } = await supabase.from('world_location_connections').select('*')
    if (error) console.error('[worldState] Error cargando conexiones:', error)
    return data || []
  }
  // Obtener IDs de ubicaciones de esta sesión y filtrar conexiones
  const locations = await getWorldLocations(sessionId)
  if (!locations.length) return []
  const ids = locations.map(l => l.id)
  const { data, error } = await supabase
    .from('world_location_connections')
    .select('*')
    .or(`from_location_id.in.(${ids.join(',')}),to_location_id.in.(${ids.join(',')})`)
  if (error) {
    console.error('[worldState] Error cargando conexiones:', error)
    return []
  }
  return data || []
}

// Calcula coordenadas para una nueva ubicación basándose en las existentes
function computeCoordinates(existingLocations, connectFromId) {
  if (!existingLocations.length || !connectFromId) {
    return { x: 400, y: 300 }
  }
  const parent = existingLocations.find(l => l.id === connectFromId)
  if (!parent?.coordinates) {
    return { x: 400, y: 300 }
  }
  const angle = Math.random() * Math.PI * 2
  const distance = 80 + Math.random() * 40
  const jitterX = (Math.random() - 0.5) * 40
  const jitterY = (Math.random() - 0.5) * 40
  return {
    x: Math.round(Math.max(40, Math.min(760, parent.coordinates.x + Math.cos(angle) * distance + jitterX))),
    y: Math.round(Math.max(40, Math.min(560, parent.coordinates.y + Math.sin(angle) * distance + jitterY))),
  }
}

// Guarda una nueva ubicación y opcionalmente la conecta a otra
export async function saveWorldLocation({ name, description, location_type, discovered_in_session, connect_from, distance_days, session_id }) {
  // Comprobar si ya existe EN ESTA SESIÓN (el mismo nombre puede existir en otra sesión distinta)
  let dupQuery = supabase.from('world_locations').select('*').ilike('name', name)
  if (session_id) dupQuery = dupQuery.eq('session_id', session_id)
  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) return existing

  // Buscar ubicación padre por nombre para calcular coordenadas
  let connectFromId = null
  const allLocations = await getWorldLocations(session_id)
  if (connect_from) {
    const parentLoc = allLocations.find(l => l.name.toLowerCase() === connect_from.toLowerCase())
    if (parentLoc) connectFromId = parentLoc.id
  }

  const coordinates = computeCoordinates(allLocations, connectFromId)

  const { data, error } = await supabase
    .from('world_locations')
    .insert({
      name,
      description: description || '',
      location_type: location_type || 'island',
      discovered_in_session,
      coordinates,
      session_id: session_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[worldState] Error guardando ubicación:', error)
    return null
  }

  // Crear conexión si hay ubicación padre
  if (connectFromId && data) {
    await supabase.from('world_location_connections').insert({
      from_location_id: connectFromId,
      to_location_id: data.id,
      distance_days: distance_days || 1,
      discovered_in_session,
    })
    console.log('[worldState] Conexión creada:', connect_from, '→', name)
  }

  console.log('[worldState] Ubicación guardada:', data?.name)
  return data
}

// ── Tool definitions para Groq function calling ─────────────────────────────

export const SAVE_WORLD_NPC_TOOL = {
  type: 'function',
  function: {
    name: 'saveWorldNpc',
    description:
      'Guarda un NPC importante del mundo (marino, pirata, personaje recurrente) para que persista entre sesiones. ' +
      'Usar cuando el narrador introduce un NPC con nombre propio y stats. ' +
      'NO llamar si el NPC ya aparece en "NPCs conocidos del mundo".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del NPC' },
        rank: {
          type: 'string',
          enum: ['fleet_admiral', 'admiral', 'vice_admiral', 'captain', 'commander', 'lieutenant', 'other'],
          description: 'Rango en la jerarquía (fleet_admiral es el más alto)',
        },
        faction: {
          type: 'string',
          enum: ['marina', 'pirata', 'gobierno', 'otro'],
          description: 'Facción a la que pertenece',
        },
        hp: { type: 'integer', description: 'Puntos de vida' },
        attack: { type: 'integer', description: 'Ataque' },
        defense: { type: 'integer', description: 'Defensa' },
        description: { type: 'string', description: 'Descripción breve del NPC (apariencia, personalidad)' },
        bounty: { type: 'integer', description: 'Recompensa en berries por derrotarlo' },
      },
      required: ['name', 'rank', 'faction', 'hp', 'attack', 'defense', 'description'],
    },
  },
}

export const SAVE_WORLD_LOCATION_TOOL = {
  type: 'function',
  function: {
    name: 'saveWorldLocation',
    description:
      'Registra una ubicación nueva del mundo (isla, puerto, fortaleza) para el mapa persistente. ' +
      'Usar cuando los jugadores llegan a un lugar nuevo con nombre propio. ' +
      'NO llamar si el lugar ya aparece en "Ubicaciones descubiertas".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del lugar' },
        description: { type: 'string', description: 'Descripción breve del lugar' },
        location_type: {
          type: 'string',
          enum: ['island', 'port', 'fortress', 'sea_zone', 'landmark'],
          description: 'Tipo de ubicación',
        },
        connect_from: { type: 'string', description: 'Nombre de la ubicación desde donde se llegó (para conectar en el mapa)' },
        distance_days: { type: 'integer', description: 'Días de viaje desde connect_from' },
      },
      required: ['name', 'description', 'location_type'],
    },
  },
}
