import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { callMechanicsModel, callNarratorModel, ModelsBusyError } from '../lib/groq'
import { getRandomItem, GET_RANDOM_ITEM_TOOL } from '../lib/items'
import { getEnemies, GET_ENEMIES_TOOL } from '../lib/enemies'
import { resolveCombatTurn } from '../lib/combat'
import {
  COMBAT_MECHANICS_SYSTEM_PROMPT,
  MECHANICS_SYSTEM_PROMPT,
  NARRATOR_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from '../lib/narrator'
import { characters as allCharacters } from '../data/characters'

const NARRATOR_CONTEXT_MESSAGES = 10
const SUMMARY_EVERY_N_MESSAGES = 10

// Herramientas disponibles para el modelo mecánico (fuera de combate)
const NORMAL_TOOL_EXECUTORS = { getRandomItem, getEnemies }
const NORMAL_TOOLS = [GET_RANDOM_ITEM_TOOL, GET_ENEMIES_TOOL]

export function useMessages(session, activeCharacter, presentIds = [], onEventComplete = null) {
  const sessionRef = useRef(session)
  const [messages, setMessages] = useState([])
  const [characterStates, setCharacterStates] = useState([])
  const [sending, setSending] = useState(false)
  const [narratorTyping, setNarratorTyping] = useState(false)
  const [diceRequest, setDiceRequest] = useState({ required: false, count: 1 })
  const [narrativeSummary, setNarrativeSummary] = useState(session?.narrative_summary || '')
  const [gameMode, setGameMode] = useState(session?.game_mode || 'normal')
  const [gameModeData, setGameModeData] = useState(session?.game_mode_data ?? null)

  const subscriptionRef = useRef(null)
  const characterStatesSubRef = useRef(null)
  const messagesRef = useRef([])
  const characterStatesRef = useRef([])
  const presentIdsRef = useRef(presentIds)
  const narrativeSummaryRef = useRef(session?.narrative_summary || '')
  // gameModeRef solo para comprobar el modo en closures async (no como fuente de verdad de los datos)
  const gameModeRef = useRef(session?.game_mode || 'normal')
  const pendingMechanicsRef = useRef(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { narrativeSummaryRef.current = narrativeSummary }, [narrativeSummary])
  useEffect(() => { characterStatesRef.current = characterStates }, [characterStates])
  useEffect(() => { presentIdsRef.current = presentIds }, [presentIds])
  useEffect(() => { sessionRef.current = session }, [session])
  // Sincronizar modo de juego desde sesión remota (otro jugador vía Realtime)
  useEffect(() => {
    setGameMode(session?.game_mode || 'normal')
    gameModeRef.current = session?.game_mode || 'normal'
  }, [session?.game_mode])
  useEffect(() => {
    setGameModeData(session?.game_mode_data ?? null)
  }, [session?.game_mode_data])

  useEffect(() => {
    if (!session) return
    loadMessages()
    loadCharacterStates()
    subscribeToMessages()
    subscribeToCharacterStates()
    return () => {
      subscriptionRef.current?.unsubscribe()
      characterStatesSubRef.current?.unsubscribe()
    }
  }, [session?.id])

  async function loadMessages() {
    const [{ data: msgs, error }, { data: sessionData }] = await Promise.all([
      supabase.from('messages').select('*').eq('session_id', session.id).order('created_at', { ascending: true }),
      supabase.from('sessions').select('narrative_summary').eq('id', session.id).single(),
    ])
    if (error) { console.error('Error cargando mensajes:', error); return }
    setMessages(msgs || [])
    if (sessionData?.narrative_summary) setNarrativeSummary(sessionData.narrative_summary)
  }

  async function loadCharacterStates() {
    const { data, error } = await supabase
      .from('session_character_state').select('*').eq('session_id', session.id)
    if (error) console.error('Error cargando estados de personajes:', error)
    else setCharacterStates(data || [])
  }

  function subscribeToMessages() {
    subscriptionRef.current = supabase
      .channel(`messages:${session.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        }
      ).subscribe()
  }

  function subscribeToCharacterStates() {
    characterStatesSubRef.current = supabase
      .channel(`char-states:${session.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'session_character_state', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setCharacterStates(prev =>
            prev.map(s => s.character_id === payload.new.character_id ? { ...s, ...payload.new } : s)
          )
        }
      ).subscribe()
  }

  // ─── Helpers de contexto ──────────────────────────────────────────────────

  function buildCharacterContext() {
    const activeIds = presentIdsRef.current
    const activeStates = characterStatesRef.current.filter(s => activeIds.includes(s.character_id))
    return allCharacters
      .filter(c => activeIds.includes(c.id))
      .map(c => {
        const state = activeStates.find(s => s.character_id === c.id)
        const hp = state ? state.hp_current : c.hp
        const inventory = state?.inventory?.length
          ? state.inventory.map(i => i.name).join(', ')
          : 'sin objetos'
        return `- ${c.name}(${c.role}) HP${hp}/${c.hp} ATK${c.attack} DEF${c.defense} NAV${c.navigation} [${c.ability.name}] ${inventory}`
      }).join('\n')
  }

  function buildMinimalCharContext() {
    return allCharacters
      .filter(c => presentIdsRef.current.includes(c.id))
      .map(c => {
        const state = characterStatesRef.current.find(s => s.character_id === c.id)
        const hp = state?.hp_current ?? c.hp
        const dead = state?.is_dead ? '☠' : ''
        return `${c.id}:HP${hp}/${c.hp} ATK${c.attack} DEF${c.defense} NAV${c.navigation}${dead}`
      }).join(' | ')
  }

  function getLeastActive() {
    const activeIds = presentIdsRef.current
    const recentMessages = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES)
    const counts = Object.fromEntries(activeIds.map(id => [id, 0]))
    for (const m of recentMessages) {
      if (m.character_id in counts) counts[m.character_id]++
    }
    return [...activeIds].sort((a, b) => counts[a] - counts[b])[0]
  }

  function getDefaultMechanics() {
    const leastActive = getLeastActive()
    return {
      dice_required: false, dice_count: 1, dice_stat: null, dice_threshold: null,
      next_character_id: leastActive || presentIdsRef.current[0] || null,
      stat_updates: [], inventory_updates: [],
      game_mode: null, game_mode_data: null,
      event_type: null, session_event: null,
    }
  }

  // Contexto del modo activo para los prompts (solo fuera de combate — en combate se pasa combat_context)
  function buildGameModeContext(currentGameModeData, currentGameMode) {
    if (!currentGameMode || currentGameMode === 'normal') return ''
    if (currentGameMode === 'combat' && currentGameModeData?.enemies) {
      const alive = currentGameModeData.enemies.filter(e => !e.defeated)
      if (!alive.length) return ''
      return `## Modo de juego activo: combat\nEnemigos vivos: ${alive.map(e => `${e.name}(HP:${e.hp})`).join(', ')}\n`
    }
    return `## Modo de juego activo: ${currentGameMode}\n${currentGameModeData ? JSON.stringify(currentGameModeData) : ''}\n`
  }

  // Contexto de historia (lore + evento actual) para el narrador, si la sesión tiene historia
  function buildStoryContext() {
    const lore = sessionRef.current?.story_lore
    const briefing = sessionRef.current?.current_event_briefing
    if (!lore && !briefing) return ''
    const parts = []
    if (lore) parts.push(`## Lore de la historia\n${lore}`)
    if (briefing) parts.push(`## Evento actual\n${briefing}\nSigue el evento actual como guía narrativa obligatoria, narrándolo con libertad creativa.`)
    return parts.join('\n\n') + '\n\n'
  }

  // ─── Prompts ──────────────────────────────────────────────────────────────

  // Prompt del modelo mecánico en modo combate (solo intenciones)
  function buildCombatMechanicsPrompt(playerAction, currentGameModeData) {
    const alive = currentGameModeData?.enemies?.filter(e => !e.defeated) || []
    const stunned = characterStatesRef.current.filter(s => s.stunned).map(s => s.character_id)
    return `Activo:${activeCharacter.id} [${activeCharacter.ability?.name}]
Acción: ${playerAction}
Personajes: ${buildMinimalCharContext()}
Enemigos vivos: ${alive.map(e => `"${e.name}"(HP:${e.hp})`).join(', ') || 'ninguno'}
${stunned.length ? `Aturdidos (pierden turno): ${stunned.join(', ')}\n` : ''}next:${getLeastActive()} no_rep:${activeCharacter.id}`
  }

  // Contexto compacto del evento activo para el modelo mecánico
  function buildEventContext() {
    const briefing = sessionRef.current?.current_event_briefing
    if (!briefing) return ''
    return `## Evento actual (activa el modo de juego correspondiente si no está activo)\n${briefing}\n`
  }

  // Prompt del modelo mecánico fuera de combate
  function buildMechanicsPrompt(playerAction, currentGameModeData, currentGameMode) {
    const leastActive = getLeastActive()
    return `Activo:${activeCharacter.id}(ATK${activeCharacter.attack} DEF${activeCharacter.defense} NAV${activeCharacter.navigation})
Acción: ${playerAction}
Personajes: ${buildMinimalCharContext()}
${buildGameModeContext(currentGameModeData, currentGameMode)}${buildEventContext()}next:${leastActive} no_rep:${activeCharacter.id}`
  }

  function buildGmMechanicsPrompt(instruction, currentGameModeData, currentGameMode) {
    const leastActive = getLeastActive()
    return `GM(${activeCharacter.id}): ${instruction}
Personajes: ${buildMinimalCharContext()}
${buildGameModeContext(currentGameModeData, currentGameMode)}${buildEventContext()}next:${leastActive}
"yo/me/mi/dame"→${activeCharacter.id} | combat:usa getEnemies() | game_mode_data completo si activa modo`
  }

  // Prompt del narrador en modo combate (recibe combatResult, no JSON mecánico crudo)
  function buildNarratorCombatPrompt(combatResult, nextTurnId, currentGameModeData) {
    const summary = narrativeSummaryRef.current
    const chatHistory = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES).map(m => {
      if (m.character_id === 'narrator') {
        const text = m.content.length > 200 ? m.content.slice(0, 200) + '…' : m.content
        return `Narrador: ${text}`
      }
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    const nextChar = allCharacters.find(c => c.id === nextTurnId)
    const alive = currentGameModeData?.enemies?.filter(e => !e.defeated) || []

    return `${buildStoryContext()}## Personajes en sesión
${buildCharacterContext()}
${summary ? `## Resumen de la sesión\n${summary}\n` : ''}## Estado del combate
Enemigos vivos: ${alive.map(e => `${e.name}(HP:${e.hp}/${e.hp_max})`).join(', ') || 'ninguno — ¡combate terminado!'}
## Historial reciente
${chatHistory}

## Resultado del turno de combate (narra esto, sin mencionar números de HP ni daño):
${JSON.stringify(combatResult)}

Termina interpelando a: ${nextChar?.name || nextTurnId}`
  }

  // Prompt del narrador fuera de combate (flujo clásico con JSON mecánico)
  function buildNarratorPrompt(playerAction, mechanics, diceResult, realNextId) {
    const summary = narrativeSummaryRef.current
    const chatHistory = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES).map(m => {
      if (m.character_id === 'narrator') {
        const text = m.content.length > 200 ? m.content.slice(0, 200) + '…' : m.content
        return `Narrador: ${text}`
      }
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    const nextId = realNextId || mechanics.next_character_id
    const nextChar = allCharacters.find(c => c.id === nextId)

    return `${buildStoryContext()}## Personajes en sesión
${buildCharacterContext()}
${summary ? `## Resumen de la sesión\n${summary}\n` : ''}## Historial reciente
${chatHistory}

## Acción de ${activeCharacter.name}:
${playerAction}
${diceResult ? `## Resultado de dados:\n${diceResult}${mechanics.dice_threshold ? ` (umbral para éxito: ${mechanics.dice_threshold})` : ''}\n` : ''}## Decisiones mecánicas (ya resueltas — nárralas):
${JSON.stringify(mechanics)}

Termina interpelando a: ${nextChar?.name || nextId}`
  }

  // ─── Aplicar efectos en Supabase ─────────────────────────────────────────

  async function applyStatUpdates(updates) {
    for (const { character_id, hp_delta } of updates) {
      const current = characterStatesRef.current.find(s => s.character_id === character_id)
      if (!current) continue
      const newHp = Math.max(0, current.hp_current + hp_delta)
      await supabase.from('session_character_state')
        .update({ hp_current: newHp })
        .eq('session_id', session.id).eq('character_id', character_id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === character_id ? { ...s, hp_current: newHp } : s)
      )
    }
  }

  async function applyInventoryUpdates(updates) {
    for (const update of updates) {
      const { character_id, action, item, item_name } = update
      const current = characterStatesRef.current.find(s => s.character_id === character_id)
      if (!current) continue
      let newInventory = [...(current.inventory || [])]
      if (action === 'add' && item?.name) {
        newInventory = [...newInventory, item]
      } else if (action === 'remove') {
        const name = item_name || item?.name
        newInventory = newInventory.filter(i => i.name !== name)
      }
      await supabase.from('session_character_state')
        .update({ inventory: newInventory })
        .eq('session_id', session.id).eq('character_id', character_id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === character_id ? { ...s, inventory: newInventory } : s)
      )
    }
  }

  async function checkAndMarkDeaths(affectedIds) {
    for (const character_id of affectedIds) {
      const state = characterStatesRef.current.find(s => s.character_id === character_id)
      if (state && state.hp_current <= 0 && !state.is_dead) {
        await supabase.from('session_character_state')
          .update({ is_dead: true })
          .eq('session_id', session.id).eq('character_id', character_id)
        setCharacterStates(prev =>
          prev.map(s => s.character_id === character_id ? { ...s, is_dead: true } : s)
        )
      }
    }
  }

  // ─── Motor de combate ─────────────────────────────────────────────────────

  // Llama al modelo de intenciones, resuelve el turno en código, narra el resultado.
  async function processCombatAction(playerAction, currentGameModeData) {
    // 1. Modelo de intenciones (mecánicas de combate simplificadas)
    let mechanics = {
      player_intent: 'attack',
      target_enemy_name: null,
      target_ally_id: null,
      use_special_ability: false,
      is_action: true,
      next_character_id: getLeastActive(),
      non_combat_event: null,
    }

    try {
      const prompt = buildCombatMechanicsPrompt(playerAction, currentGameModeData)
      const raw = await callMechanicsModel(COMBAT_MECHANICS_SYSTEM_PROMPT, prompt, {
        json: true, maxTokens: 150, temperature: 0.1, useTools: false,
      })
      if (raw) {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) mechanics = { ...mechanics, ...JSON.parse(match[0]) }
      }
      console.log('[combat] intención del modelo:', JSON.stringify(mechanics))
    } catch (err) {
      console.warn('[combat] modelo de intenciones falló, usando defaults:', err?.message)
    }

    // 2. Resolver el turno en código (función pura)
    const result = resolveCombatTurn({
      mechanics,
      activeCharacter,
      gameModeData: currentGameModeData,
      characterStates: characterStatesRef.current,
      presentIds: presentIdsRef.current,
      currentTurnId: sessionRef.current?.current_turn_character_id,
    })

    const { combatResult, newGameModeData, newMode, playerUpdates, aoeUpdates, nextTurnId, defeatedEnemies } = result
    console.log('[combat] resultado:', JSON.stringify(combatResult))

    // 3. Narrar el turno ANTES de escribir en Supabase (para que sea inmediato)
    await deliverCombatNarrative(combatResult, nextTurnId, newGameModeData ?? currentGameModeData)

    // 4. Escribir todos los cambios en Supabase (dos llamadas)
    await supabase.from('sessions')
      .update({
        game_mode: newMode,
        game_mode_data: newGameModeData,
        current_turn_character_id: nextTurnId,
      })
      .eq('id', session.id)

    // Actualizar estado local del modo inmediatamente (sin esperar Realtime)
    setGameMode(newMode)
    setGameModeData(newGameModeData)
    gameModeRef.current = newMode

    // Daño al jugador activo (incluye stunned: true/false si aplica)
    if (playerUpdates.length > 0) {
      const { character_id, hp_current, is_dead, stunned } = playerUpdates[0]
      const updateFields = { hp_current }
      if (is_dead) updateFields.is_dead = true
      if (stunned !== undefined) updateFields.stunned = stunned
      await supabase.from('session_character_state')
        .update(updateFields)
        .eq('session_id', session.id).eq('character_id', character_id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === character_id ? { ...s, ...updateFields } : s)
      )
    }

    // Daño AoE al resto de jugadores
    for (const { character_id, hp_current } of aoeUpdates) {
      const is_dead = hp_current <= 0
      const updateFields = { hp_current, ...(is_dead ? { is_dead: true } : {}) }
      await supabase.from('session_character_state')
        .update(updateFields)
        .eq('session_id', session.id).eq('character_id', character_id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === character_id ? { ...s, ...updateFields } : s)
      )
    }

    // Curación (heal ability)
    if (combatResult.heal_target && combatResult.heal_amount > 0) {
      const current = characterStatesRef.current.find(s => s.character_id === combatResult.heal_target)
      if (current) {
        const char = allCharacters.find(c => c.id === combatResult.heal_target)
        const newHp = Math.min(char?.hp ?? 999, current.hp_current + combatResult.heal_amount)
        await supabase.from('session_character_state')
          .update({ hp_current: newHp })
          .eq('session_id', session.id).eq('character_id', combatResult.heal_target)
        setCharacterStates(prev =>
          prev.map(s => s.character_id === combatResult.heal_target ? { ...s, hp_current: newHp } : s)
        )
      }
    }

    // Marcar muertes
    const affectedIds = [
      ...playerUpdates.map(u => u.character_id),
      ...aoeUpdates.map(u => u.character_id),
    ]
    if (affectedIds.length) await checkAndMarkDeaths(affectedIds)

    // Botín automático si el combate terminó
    if (newMode === 'normal') {
      await distributeLoot(defeatedEnemies)
      // Notificar al Director que el evento de combate se completó
      if (onEventComplete) await onEventComplete()
    }
  }

  // Llama al narrador solo con combatResult (sin JSON mecánico crudo)
  async function deliverCombatNarrative(combatResult, nextTurnId, currentGameModeData) {
    let narrative
    try {
      narrative = await callNarratorModel(
        NARRATOR_SYSTEM_PROMPT,
        buildNarratorCombatPrompt(combatResult, nextTurnId, currentGameModeData)
      )
    } catch (err) {
      if (err instanceof ModelsBusyError) {
        await supabase.from('messages').insert({
          session_id: session.id, character_id: 'narrator',
          content: 'Los servidores están ocupados, inténtalo en unos minutos.', type: 'narrator',
        })
      }
      return
    }
    if (!narrative) return
    await supabase.from('messages').insert({
      session_id: session.id, character_id: 'narrator',
      content: narrative, type: 'narrator',
    })
  }

  // Distribuye loot al final del combate usando las loot_tables de los enemigos derrotados
  async function distributeLoot(defeatedEnemies) {
    if (!defeatedEnemies?.length) return

    // Usar la tabla del enemigo más difícil (el que tiene mayor chance de raro/único)
    const bestEnemy = defeatedEnemies.reduce((best, e) => {
      const score = (e.loot_table?.raro ?? 0) + (e.loot_table?.único ?? 0) * 2
      const bScore = (best?.loot_table?.raro ?? 0) + (best?.loot_table?.único ?? 0) * 2
      return score > bScore ? e : best
    }, defeatedEnemies[0])

    const lootTable = bestEnemy?.loot_table || { común: 0.50 }
    const lootType = bestEnemy?.loot_type || 'cualquiera'

    const lootUpdates = []
    for (const id of presentIdsRef.current) {
      const roll = Math.random()
      const uniqueThreshold = lootTable.único ?? 0
      const rareThreshold = uniqueThreshold + (lootTable.raro ?? 0)
      const commonThreshold = rareThreshold + (lootTable.común ?? 0)

      let rarity = null
      if (roll < uniqueThreshold) rarity = 'único'
      else if (roll < rareThreshold) rarity = 'raro'
      else if (roll < commonThreshold) rarity = 'común'

      if (rarity) {
        const types = lootType === 'cualquiera' ? ['arma', 'equipo', 'consumible'] : [lootType]
        const type = types[Math.floor(Math.random() * types.length)]
        try {
          const item = await getRandomItem({ type, rarity })
          if (item) lootUpdates.push({ character_id: id, action: 'add', item })
        } catch (e) {
          console.warn('[loot] error obteniendo item:', e)
        }
      }
    }

    if (lootUpdates.length > 0) {
      await applyInventoryUpdates(lootUpdates)
      console.log('[loot] distribuido:', lootUpdates.map(u => `${u.character_id}: ${u.item?.name}`).join(', '))
    }
  }

  // ─── Motor fuera de combate ───────────────────────────────────────────────

  async function processAction(playerAction, { isGm = false, gmInstruction = null } = {}) {
    // Capturar el estado actual ANTES de cualquier await (evita closures stale)
    const currentGameMode = gameMode
    const currentGameModeData = gameModeData

    setNarratorTyping(true)

    // ── Rama COMBATE ─────────────────────────────────────────────────────────
    if (currentGameMode === 'combat') {
      await processCombatAction(playerAction, currentGameModeData)
      setNarratorTyping(false)
      return
    }

    // ── Rama NORMAL (fuera de combate) ────────────────────────────────────────
    let mechanics = getDefaultMechanics()
    try {
      const mechanicsPrompt = isGm && gmInstruction
        ? buildGmMechanicsPrompt(gmInstruction, currentGameModeData, currentGameMode)
        : buildMechanicsPrompt(playerAction, currentGameModeData, currentGameMode)

      const estSystem = Math.round(MECHANICS_SYSTEM_PROMPT.length / 4)
      const estUser = Math.round(mechanicsPrompt.length / 4)
      console.log(`[tokens mecánico] system:~${estSystem} user:~${estUser} total:~${estSystem + estUser}`)

      const raw = await callMechanicsModel(MECHANICS_SYSTEM_PROMPT, mechanicsPrompt, {
        useTools: true,
        toolExecutors: NORMAL_TOOL_EXECUTORS,
        tools: NORMAL_TOOLS,
      })
      if (raw) {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) mechanics = { ...mechanics, ...JSON.parse(match[0]) }
      }
      console.log('[processAction] mecánicas:', JSON.stringify(mechanics))
    } catch (err) {
      if (err instanceof ModelsBusyError) {
        console.warn('[mecánico] Todos los modelos ocupados, usando defaults')
      } else {
        console.warn('Modelo mecánico falló, usando defaults:', err)
      }
    }

    // Corrección de turno en código
    if (mechanics.dice_required) {
      mechanics.next_character_id = activeCharacter.id
    } else {
      const activeIds = presentIdsRef.current
      if (mechanics.next_character_id === activeCharacter.id && activeIds.length > 1) {
        mechanics.next_character_id = getLeastActive()
      }
    }

    if (mechanics.dice_required) {
      const diceCount = mechanics.dice_count || 1
      if (isGm) {
        const rolls = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6))
        const total = rolls.reduce((a, b) => a + b, 0)
        const diceContent = diceCount === 1 ? `🎲 ${rolls[0]} = ${total}` : `🎲 ${rolls.join(' + ')} = ${total}`
        await supabase.from('messages').insert({
          session_id: session.id, character_id: activeCharacter.id,
          content: diceContent, type: 'dice',
        })
        await deliverNarrative(playerAction, mechanics, diceContent, { gmInstruction })
        setNarratorTyping(false)
        return
      }
      pendingMechanicsRef.current = { mechanics, playerAction, gmInstruction }
      setDiceRequest({ required: true, count: diceCount })
      setNarratorTyping(false)
      return
    }

    await deliverNarrative(playerAction, mechanics, null, { gmInstruction, currentGameModeData, currentGameMode })
    setNarratorTyping(false)
  }

  // Narración + efectos para flujo fuera de combate
  async function deliverNarrative(playerAction, mechanics, diceResult, {
    gmInstruction = null,
    currentGameModeData = gameModeData,
    currentGameMode = gameMode,
  } = {}) {
    // Calcular siguiente turno
    const aliveIds = presentIdsRef.current.filter(
      id => !characterStatesRef.current.find(cs => cs.character_id === id)?.is_dead
    )
    let realNextId = mechanics.next_character_id
    if (realNextId && characterStatesRef.current.find(cs => cs.character_id === realNextId)?.is_dead) {
      realNextId = aliveIds.find(id => id !== activeCharacter.id) || aliveIds[0] || realNextId
    }

    const systemPrompt = gmInstruction
      ? `${NARRATOR_SYSTEM_PROMPT}\n\n## INSTRUCCIÓN ACTIVA DEL GM — PRIORIDAD ABSOLUTA:\n${gmInstruction}\nEjecuta exactamente lo que pide. No la ignores ni la suavices.`
      : NARRATOR_SYSTEM_PROMPT

    let narrative
    try {
      narrative = await callNarratorModel(systemPrompt, buildNarratorPrompt(playerAction, mechanics, diceResult, realNextId))
    } catch (err) {
      if (err instanceof ModelsBusyError) {
        await supabase.from('messages').insert({
          session_id: session.id, character_id: 'narrator',
          content: 'Los servidores están ocupados, inténtalo en unos minutos.', type: 'narrator',
        })
      }
      return
    }
    if (!narrative) return

    await supabase.from('messages').insert({
      session_id: session.id, character_id: 'narrator',
      content: narrative, type: 'narrator',
    })

    if (mechanics.stat_updates?.length > 0) {
      await applyStatUpdates(mechanics.stat_updates)
      await checkAndMarkDeaths(mechanics.stat_updates.map(u => u.character_id))
    }
    // Inventory solo fuera de combate
    if (currentGameMode !== 'combat' && mechanics.inventory_updates?.length > 0) {
      await applyInventoryUpdates(mechanics.inventory_updates)
    }
    if (mechanics.game_mode) {
      await applyGameMode(mechanics, currentGameMode)
      // Si el modo vuelve a normal desde un modo de evento, el evento se completó
      if (mechanics.game_mode === 'normal' && currentGameMode !== 'normal' && onEventComplete) {
        await onEventComplete()
      }
    }

    if (realNextId && presentIdsRef.current.includes(realNextId)) {
      await supabase.from('sessions')
        .update({ current_turn_character_id: realNextId })
        .eq('id', session.id)
    }

    const playerMessages = messagesRef.current.filter(m => m.type === 'player' || m.type === 'action')
    if (playerMessages.length > 0 && playerMessages.length % SUMMARY_EVERY_N_MESSAGES === 0) {
      updateNarrativeSummary()
    }
  }

  // Actualiza el modo de juego en Supabase con los datos del modelo mecánico
  async function applyGameMode(mechanics, currentGameMode) {
    const newMode = mechanics.game_mode
    let newData = mechanics.game_mode_data
    if (!newMode) return

    if (newMode === 'combat' && currentGameMode === 'combat') return

    if (newMode === 'combat' && newData?.enemies) {
      newData = {
        ...newData,
        enemies: newData.enemies.map(e => {
          const maxHp = (e.hp_max > 0 ? e.hp_max : null) ?? (e.hp > 0 ? e.hp : 5)
          return { ...e, hp: maxHp, hp_max: maxHp, defeated: false, ability_used: false }
        }),
      }
    }

    await supabase.from('sessions')
      .update({ game_mode: newMode, game_mode_data: newData })
      .eq('id', session.id)

    setGameMode(newMode)
    setGameModeData(newData)
    gameModeRef.current = newMode
  }

  // ─── Acciones del jugador ─────────────────────────────────────────────────

  async function sendMessage(content) {
    if (!content.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: content.trim(), type: 'player',
    })
    if (error) { console.error('Error guardando mensaje:', error); setSending(false); return }

    const isMyTurn = session.current_turn_character_id === activeCharacter.id
    if (isMyTurn) await processAction(content.trim())
    setSending(false)
  }

  async function sendAction(action) {
    if (!action.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: action.trim(), type: 'action',
    })
    const isMyTurn = session.current_turn_character_id === activeCharacter.id
    if (isMyTurn) await processAction(`[${activeCharacter.name} realiza una acción: ${action.trim()}]`)
    setSending(false)
  }

  async function sendChat(content) {
    if (!content.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: content.trim(), type: 'player',
    })
    setSending(false)
  }

  async function sendGmMessage(instruction) {
    if (!instruction.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: instruction.trim(), type: 'gm',
    })
    await processAction(`[Instrucción del maestro de juego: ${instruction.trim()}]`, {
      isGm: true, gmInstruction: instruction.trim(),
    })
    setSending(false)
  }

  async function rollDice() {
    if (sending) return
    const { count } = diceRequest
    const rolls = Array.from({ length: count }, () => Math.ceil(Math.random() * 6))
    const total = rolls.reduce((a, b) => a + b, 0)
    const content = count === 1 ? `🎲 ${rolls[0]} = ${total}` : `🎲 ${rolls.join(' + ')} = ${total}`

    setDiceRequest({ required: false, count: 1 })
    setSending(true)

    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content, type: 'dice',
    })

    const pending = pendingMechanicsRef.current
    pendingMechanicsRef.current = null

    const mechanics = pending?.mechanics || getDefaultMechanics()
    const playerAction = pending?.playerAction || `[Tirada de dados: ${content}]`
    const gmInstruction = pending?.gmInstruction || null

    setNarratorTyping(true)
    await deliverNarrative(playerAction, mechanics, content, { gmInstruction })
    setNarratorTyping(false)
    setSending(false)
  }

  async function rollInitiative() {
    if (sending) return
    const s = sessionRef.current
    if (s?.game_mode !== 'combat') return

    const roll = Math.ceil(Math.random() * 6) + activeCharacter.attack
    const content = `🎲 Iniciativa: ${roll} (1d6 + ${activeCharacter.attack} ATK)`

    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content, type: 'dice',
    })

    const currentData = s.game_mode_data || {}
    const initiative = { ...(currentData.initiative || {}), [activeCharacter.id]: roll }
    const updatedData = { ...currentData, initiative }

    const allRolled = presentIdsRef.current.every(id => initiative[id] !== undefined)
    if (allRolled) {
      const combatOrder = [...presentIdsRef.current].sort(
        (a, b) => (initiative[b] || 0) - (initiative[a] || 0)
      )
      updatedData.combat_turn_order = combatOrder
      const firstId = combatOrder[0]
      await supabase.from('sessions')
        .update({ game_mode_data: updatedData, current_turn_character_id: firstId })
        .eq('id', session.id)
    } else {
      await supabase.from('sessions')
        .update({ game_mode_data: updatedData })
        .eq('id', session.id)
    }
    setGameModeData(updatedData)
    sessionRef.current = { ...sessionRef.current, game_mode_data: updatedData }
    setSending(false)
  }

  async function startGame() {
    if (sending) return
    const { data: existing } = await supabase
      .from('messages').select('id').eq('session_id', session.id).limit(1)
    if (existing?.length > 0) return

    setSending(true)
    const activeIds = presentIdsRef.current
    const firstCharacter = allCharacters.find(c => c.id === activeIds[0])

    const openingPrompt = `## Personajes en sesión
${buildCharacterContext()}

## Inicio de partida
Partida nueva. Presenta la escena inicial de forma evocadora e interpela al primer jugador: ${firstCharacter?.name} (${firstCharacter?.role}).
Personajes presentes: ${activeIds.join(', ')}.`

    setNarratorTyping(true)
    const narrative = await callNarratorModel(NARRATOR_SYSTEM_PROMPT, openingPrompt)
    setNarratorTyping(false)
    if (narrative) {
      await supabase.from('messages').insert({
        session_id: session.id, character_id: 'narrator',
        content: narrative, type: 'narrator',
      })
      if (firstCharacter) {
        await supabase.from('sessions')
          .update({ current_turn_character_id: firstCharacter.id })
          .eq('id', session.id)
      }
    }
    setSending(false)
  }

  async function announceEntry() {
    if (sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: `${activeCharacter.name} entra en la sala.`, type: 'action',
    })
    setSending(false)
  }

  async function updateNarrativeSummary() {
    const recentForSummary = messagesRef.current.slice(-SUMMARY_EVERY_N_MESSAGES).map(m => {
      if (m.character_id === 'narrator') return `N: ${m.content.slice(0, 150)}`
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    const currentSummary = narrativeSummaryRef.current
    const userContent = currentSummary
      ? `Resumen actual:\n${currentSummary}\n\nNuevos eventos:\n${recentForSummary}\n\nActualiza el resumen incorporando los nuevos eventos. Máximo 120 palabras.`
      : `Resume estos eventos de rol en máximo 120 palabras:\n\n${recentForSummary}`

    try {
      const summary = await callMechanicsModel(SUMMARY_SYSTEM_PROMPT, userContent, {
        json: false, maxTokens: 200, temperature: 0.3,
      })
      if (!summary) return
      setNarrativeSummary(summary)
      await supabase.from('sessions').update({ narrative_summary: summary }).eq('id', session.id)
    } catch (err) {
      console.error('Error actualizando resumen narrativo:', err)
    }
  }

  // ─── Acciones de inventario ───────────────────────────────────────────────

  // Usa o equipa un item del inventario del jugador activo.
  // Consumibles: aplica efecto HP y se elimina. Equippables: se marcan como equipados.
  async function useItem(item, itemIndex) {
    const current = characterStatesRef.current.find(s => s.character_id === activeCharacter.id)
    if (!current) return

    // Aplicar efecto de HP si es consumible
    if (!item.equippable) {
      const hpEffect = item.effects?.find(e => e.stat === 'hp')
      if (hpEffect) {
        const char = allCharacters.find(c => c.id === activeCharacter.id)
        const newHp = Math.min(char?.hp ?? 999, Math.max(0, current.hp_current + hpEffect.modifier))
        await supabase.from('session_character_state')
          .update({ hp_current: newHp })
          .eq('session_id', session.id).eq('character_id', activeCharacter.id)
        setCharacterStates(prev =>
          prev.map(s => s.character_id === activeCharacter.id ? { ...s, hp_current: newHp } : s)
        )
      }
    }

    // Actualizar inventario: equipar o eliminar
    const newInventory = item.equippable
      ? (current.inventory || []).map((it, i) => i === itemIndex ? { ...it, equipped: true } : it)
      : (current.inventory || []).filter((_, i) => i !== itemIndex)

    await supabase.from('session_character_state')
      .update({ inventory: newInventory })
      .eq('session_id', session.id).eq('character_id', activeCharacter.id)
    setCharacterStates(prev =>
      prev.map(s => s.character_id === activeCharacter.id ? { ...s, inventory: newInventory } : s)
    )
  }

  // Transfiere un item del inventario del jugador activo al de un aliado.
  async function giftItem(item, itemIndex, targetCharId) {
    const ownState = characterStatesRef.current.find(s => s.character_id === activeCharacter.id)
    const targetState = characterStatesRef.current.find(s => s.character_id === targetCharId)
    if (!ownState) return

    const newOwnInventory = (ownState.inventory || []).filter((_, i) => i !== itemIndex)
    const newTargetInventory = [...(targetState?.inventory || []), item]

    await Promise.all([
      supabase.from('session_character_state')
        .update({ inventory: newOwnInventory })
        .eq('session_id', session.id).eq('character_id', activeCharacter.id),
      supabase.from('session_character_state')
        .update({ inventory: newTargetInventory })
        .eq('session_id', session.id).eq('character_id', targetCharId),
    ])
    setCharacterStates(prev => prev.map(s => {
      if (s.character_id === activeCharacter.id) return { ...s, inventory: newOwnInventory }
      if (s.character_id === targetCharId) return { ...s, inventory: newTargetInventory }
      return s
    }))
  }

  async function debugAddItem(item) {
    const current = characterStatesRef.current.find(s => s.character_id === activeCharacter.id)
    if (!current) return
    const newInventory = [...(current.inventory || []), item]
    await supabase.from('session_character_state')
      .update({ inventory: newInventory })
      .eq('session_id', session.id).eq('character_id', activeCharacter.id)
    setCharacterStates(prev =>
      prev.map(s => s.character_id === activeCharacter.id ? { ...s, inventory: newInventory } : s)
    )
  }

  return {
    messages, sending, narratorTyping,
    sendMessage, sendChat, sendAction, sendGmMessage,
    diceRequest, rollDice, rollInitiative,
    characterStates, gameMode, gameModeData,
    startGame, announceEntry, debugAddItem,
    useItem, giftItem,
  }
}
