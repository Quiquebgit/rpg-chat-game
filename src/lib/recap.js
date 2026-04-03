import { supabase } from './supabase'
import { callNarratorModel } from './groq'
import { characters as allCharacters } from '../data/characters'

// Parsea mensajes de tipo 'dice' para extraer las mejores tiradas.
// Formato esperado: "🎲 X + Y (stat) = TOTAL · DC:N · degree"
function parseDiceMessages(messages) {
  const rolls = []
  for (const msg of messages) {
    if (msg.type !== 'dice') continue
    const raw = msg.content.replace('🎲 ', '')
    const parts = raw.split(' · ')
    const diceAndTotal = parts[0]
    const dcTag = parts.find(p => p.startsWith('DC:'))
    const dc = dcTag ? Number(dcTag.slice(3)) : null
    const degree = parts.find(p =>
      ['critical_success', 'success', 'failure', 'critical_failure'].includes(p)
    ) || null

    const eqIdx = diceAndTotal.lastIndexOf(' = ')
    if (eqIdx === -1) continue
    const total = Number(diceAndTotal.slice(eqIdx + 3))
    if (isNaN(total)) continue

    const charName = allCharacters.find(c => c.id === msg.character_id)?.name || msg.character_id
    rolls.push({ character: charName, characterId: msg.character_id, total, dc, degree })
  }
  return rolls
}

// Genera el recap analizando los mensajes y estados de personaje.
export function parseRecapFromMessages(messages, characterStates) {
  const rolls = parseDiceMessages(messages)

  // Mejores tiradas (top 3 por total)
  const bestRolls = [...rolls]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(r => ({
      character: r.character,
      total: r.total,
      degree: r.degree,
    }))

  // Muertes
  const deaths = (characterStates || [])
    .filter(cs => cs.is_dead)
    .map(cs => ({
      character: allCharacters.find(c => c.id === cs.character_id)?.name || cs.character_id,
    }))

  // Stats por personaje
  const stats = {}
  for (const cs of (characterStates || [])) {
    const charName = allCharacters.find(c => c.id === cs.character_id)?.name || cs.character_id
    const charRolls = rolls.filter(r => r.characterId === cs.character_id)
    const successes = charRolls.filter(r => r.degree === 'success' || r.degree === 'critical_success').length
    stats[cs.character_id] = {
      name: charName,
      xp_earned: cs.xp || 0,
      money_earned: cs.money || 0,
      rolls_made: charRolls.length,
      successes,
    }
  }

  // MVP: m\u00e1s \u00e9xitos, desempate por m\u00e1s tiradas
  const mvpEntry = Object.entries(stats)
    .sort(([, a], [, b]) => (b.successes - a.successes) || (b.rolls_made - a.rolls_made))
    [0]
  const mvp = mvpEntry ? mvpEntry[0] : null
  const mvpName = mvpEntry ? mvpEntry[1].name : null

  // Duraci\u00f3n
  const firstMsg = messages[0]
  const lastMsg = messages[messages.length - 1]
  const durationMs = firstMsg && lastMsg
    ? new Date(lastMsg.created_at) - new Date(firstMsg.created_at)
    : 0
  const durationMinutes = Math.round(durationMs / 60000)

  return {
    highlights: [], // Se rellenan con IA despu\u00e9s
    best_rolls: bestRolls,
    deaths,
    stats,
    mvp,
    mvp_name: mvpName,
    total_messages: messages.length,
    duration_minutes: durationMinutes,
  }
}

// Genera 2-3 highlights \u00e9picos a partir del resumen narrativo usando IA.
// Si falla, devuelve un array vac\u00edo (la feature no es cr\u00edtica).
export async function generateHighlights(narrativeSummary) {
  if (!narrativeSummary || narrativeSummary.length < 20) return []

  try {
    const result = await callNarratorModel(
      'Eres un cronista pirata. Dado un resumen de aventura, escribe exactamente 3 frases cortas y \u00e9picas que resuman los momentos m\u00e1s memorables. Una frase por l\u00ednea, sin n\u00fameros ni vi\u00f1etas. En espa\u00f1ol.',
      narrativeSummary
    )
    if (!result) return []
    return result.split('\n').map(l => l.trim()).filter(l => l.length > 5).slice(0, 3)
  } catch (err) {
    console.error('[recap] Error generando highlights:', err)
    return []
  }
}

// Genera y guarda el recap completo para una sesi\u00f3n.
export async function generateAndSaveRecap(sessionId) {
  // Cargar todos los mensajes de la sesi\u00f3n
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  // Cargar estados de personaje
  const { data: characterStates } = await supabase
    .from('session_character_state')
    .select('*')
    .eq('session_id', sessionId)

  // Cargar resumen narrativo
  const { data: sessionData } = await supabase
    .from('sessions')
    .select('narrative_summary')
    .eq('id', sessionId)
    .single()

  if (!messages?.length) return null

  const recap = parseRecapFromMessages(messages, characterStates || [])

  // Generar highlights con IA (no bloquea si falla)
  const highlights = await generateHighlights(sessionData?.narrative_summary || '')
  recap.highlights = highlights

  // Guardar en la BD
  await supabase
    .from('sessions')
    .update({ session_recap: recap })
    .eq('id', sessionId)

  return recap
}
