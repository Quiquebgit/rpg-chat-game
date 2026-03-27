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
import { createPromptBuilders } from '../lib/prompts'

const SUMMARY_EVERY_N_MESSAGES = 10

// Herramientas disponibles para el modelo mecánico (fuera de combate)
const NORMAL_TOOL_EXECUTORS = { getRandomItem, getEnemies }
const NORMAL_TOOLS = [GET_RANDOM_ITEM_TOOL, GET_ENEMIES_TOOL]

export function useMessages(session, activeCharacter, presentIds = [], onEventComplete = null, currentEventSetup = null) {
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
  const currentEventSetupRef = useRef(currentEventSetup)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { narrativeSummaryRef.current = narrativeSummary }, [narrativeSummary])
  useEffect(() => { characterStatesRef.current = characterStates }, [characterStates])
  useEffect(() => { presentIdsRef.current = presentIds }, [presentIds])
  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { currentEventSetupRef.current = currentEventSetup }, [currentEventSetup])
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

  // Constructores de prompts — se recrean en cada render para tener activeCharacter actualizado
  const {
    buildCharacterContext,
    buildMinimalCharContext,
    getLeastActive,
    getDefaultMechanics,
    buildGameModeContext,
    buildStoryContext,
    buildEventContext,
    buildRecentNarratorContext,
    buildActiveInventoryContext,
    buildBeatContext,
    buildCombatMechanicsPrompt,
    buildMechanicsPrompt,
    buildGmMechanicsPrompt,
    buildNarratorCombatPrompt,
    buildNarratorPrompt,
    buildNavigationNarratorPrompt,
  } = createPromptBuilders({ activeCharacter, presentIdsRef, characterStatesRef, messagesRef, narrativeSummaryRef, sessionRef })

  // Avanza el contador de turno del beat y pasa al siguiente si se agotó
  async function advanceBeatIfNeeded() {
    const s = sessionRef.current
    const beats = s?.current_beats
    if (!beats?.length) return
    const index = s.current_beat_index ?? 0
    const turnsUsed = s.current_beat_turns_used ?? 0
    if (index >= beats.length) return

    const beat = beats[index]
    const newTurnsUsed = turnsUsed + 1

    if (newTurnsUsed >= beat.max_turns) {
      const newIndex = index + 1
      await supabase.from('sessions')
        .update({ current_beat_index: newIndex, current_beat_turns_used: 0 })
        .eq('id', session.id)
      sessionRef.current = { ...sessionRef.current, current_beat_index: newIndex, current_beat_turns_used: 0 }
      console.log(`[beat] Beat ${index} completado → beat ${newIndex}`)
    } else {
      await supabase.from('sessions')
        .update({ current_beat_turns_used: newTurnsUsed })
        .eq('id', session.id)
      sessionRef.current = { ...sessionRef.current, current_beat_turns_used: newTurnsUsed }
    }
  }

  // ─── Prompt del narrador en modo combate (recibe combatResult, no JSON mecánico crudo) ───
  // (buildNarratorCombatPrompt está en prompts.js)

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
      allCharacters,
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

    // Actualizar estado del jugador activo (daño, stun, first_attack_done, combat_ability_used)
    if (playerUpdates.length > 0) {
      const { character_id, hp_current, is_dead, stunned, first_attack_done, combat_ability_used } = playerUpdates[0]
      const updateFields = {}
      if (hp_current !== undefined) updateFields.hp_current = hp_current
      if (is_dead) updateFields.is_dead = true
      if (stunned !== undefined) updateFields.stunned = stunned
      if (first_attack_done) updateFields.first_attack_done = true
      if (combat_ability_used) updateFields.combat_ability_used = true
      if (Object.keys(updateFields).length > 0) {
        await supabase.from('session_character_state')
          .update(updateFields)
          .eq('session_id', session.id).eq('character_id', character_id)
        setCharacterStates(prev =>
          prev.map(s => s.character_id === character_id ? { ...s, ...updateFields } : s)
        )
      }
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
      // Si el combate vino de "dar la vuelta" en navegación, restaurar el modo navegación
      await distributeLoot(defeatedEnemies)
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
    await advanceBeatIfNeeded()
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
        maxTokens: 800,
      })
      if (raw) {
        console.log('[mecánico] raw:', raw.slice(0, 300))
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            mechanics = { ...mechanics, ...JSON.parse(match[0]) }
          } catch (parseErr) {
            console.warn('[mecánico] JSON inválido (¿truncado?):', parseErr.message, '| raw length:', raw.length)
          }
        }
      }
      console.log('[processAction] game_mode:', mechanics.game_mode, '| enemies:', mechanics.game_mode_data?.enemies?.length ?? 'n/a')
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

    await advanceBeatIfNeeded()

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
        boosts: {},
        fruit_specials_used: {},
      }
      // Resetear contadores de combate para todos los jugadores presentes
      for (const id of presentIdsRef.current) {
        await supabase.from('session_character_state')
          .update({ combat_ability_used: false, first_attack_done: false, stunned: false })
          .eq('session_id', session.id).eq('character_id', id)
      }
      setCharacterStates(prev =>
        prev.map(s => presentIdsRef.current.includes(s.character_id)
          ? { ...s, combat_ability_used: false, first_attack_done: false, stunned: false }
          : s
        )
      )
    }

    if (newMode === 'navigation') {
      // El umbral escala con el número de jugadores activos.
      // El modelo mecánico define la dificultad base (por jugador); aquí se multiplica.
      const numPlayers = presentIdsRef.current.length || 1
      const baseThreshold = newData?.danger_threshold || 10
      newData = {
        ...newData,
        danger_threshold: baseThreshold * numPlayers,
        navigation_accumulated: 0,
        navigation_rolls: [],
        all_players_rolled: false,
        risky_move_used: false,
        options_visible: false,
      }
    }

    await supabase.from('sessions')
      .update({ game_mode: newMode, game_mode_data: newData })
      .eq('id', session.id)

    setGameMode(newMode)
    setGameModeData(newData)
    gameModeRef.current = newMode
  }

  // Suma bonos de equipo + frutas para una stat del jugador activo
  function getEffectiveStat(characterId, stat) {
    const state = characterStatesRef.current.find(s => s.character_id === characterId)
    const inventory = state?.inventory || []
    const bonus = inventory
      .filter(i => i.equipped || i.is_fruit)
      .flatMap(i => i.effects || [])
      .filter(e => e.stat === stat)
      .reduce((sum, e) => sum + (e.modifier || e.value || 0), 0)
    const char = allCharacters.find(c => c.id === characterId)
    return (char?.[stat] ?? 0) + bonus
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

    const effAtk = getEffectiveStat(activeCharacter.id, 'attack')
    const roll = Math.ceil(Math.random() * 6) + effAtk
    const atkBonus = effAtk - activeCharacter.attack
    const atkLabel = atkBonus > 0 ? `${activeCharacter.attack}+${atkBonus}` : `${activeCharacter.attack}`
    const content = `🎲 Iniciativa: ${roll} (1d6 + ${atkLabel} ATK)`

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
      ? (current.inventory || []).map((it, i) => i === itemIndex ? { ...it, equipped: true, ...(it.type === 'fruta' ? { is_fruit: true } : {}) } : it)
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

  // ─── Navegación ───────────────────────────────────────────────────────────

  // Tirada de navegación: dado(s) + stat navegación del personaje
  async function rollNavigation(useAbility = false) {
    if (sending) return
    setSending(true)

    const data = gameModeData || {}
    const diceCount = currentEventSetupRef.current?.dice_count || data.dice_count || 1
    const threshold = data.danger_threshold || data.navigation_threshold || 10
    const accumulated = data.navigation_accumulated || 0

    // Tirar dados y sumar navegación efectiva del personaje (base + equipo + frutas)
    const rolls = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6))
    const diceTotal = rolls.reduce((a, b) => a + b, 0)
    const effNav = getEffectiveStat(activeCharacter.id, 'navigation')
    const navBonus = effNav - activeCharacter.navigation
    const navLabel = navBonus > 0 ? `${activeCharacter.navigation}+${navBonus}` : `${activeCharacter.navigation}`
    const abilityBonus = useAbility ? (activeCharacter.ability?.effect?.value ?? activeCharacter.ability?.value ?? 3) : 0
    const totalResult = diceTotal + effNav + abilityBonus

    const abilityLabel = useAbility ? ` + ${abilityBonus} (${activeCharacter.ability.name})` : ''
    const rollDesc = diceCount === 1
      ? `🎲 Navegación: ${diceTotal} + ${navLabel} NAV${abilityLabel} = **${totalResult}**`
      : `🎲 Navegación: (${rolls.join('+')}=${diceTotal}) + ${navLabel} NAV${abilityLabel} = **${totalResult}**`

    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: rollDesc, type: 'dice',
    })

    // Marcar habilidad como usada si aplica
    if (useAbility) {
      await supabase.from('session_character_state')
        .update({ ability_used: true })
        .eq('session_id', session.id).eq('character_id', activeCharacter.id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === activeCharacter.id ? { ...s, ability_used: true } : s)
      )
    }

    // Actualizar acumulado y rastrear quién ha tirado esta ronda
    const newAccumulated = accumulated + totalResult
    const completed = newAccumulated >= threshold
    const prevRolls = data.navigation_rolls || []
    const newRolls = prevRolls.includes(activeCharacter.id) ? prevRolls : [...prevRolls, activeCharacter.id]
    const allRolled = presentIdsRef.current.every(id => newRolls.includes(id))
    const optionsVisible = !completed && allRolled

    const newGameModeData = {
      ...data,
      navigation_accumulated: newAccumulated,
      navigation_rolls: newRolls,
      all_players_rolled: allRolled,
      options_visible: optionsVisible,
    }

    if (completed) {
      await supabase.from('sessions')
        .update({ game_mode: 'normal', game_mode_data: newGameModeData })
        .eq('id', session.id)
      setGameMode('normal')
      gameModeRef.current = 'normal'
    } else {
      await supabase.from('sessions')
        .update({ game_mode_data: newGameModeData })
        .eq('id', session.id)
    }
    setGameModeData(newGameModeData)

    // Narrar la tirada
    setNarratorTyping(true)
    try {
      const narrative = await callNarratorModel(
        NARRATOR_SYSTEM_PROMPT,
        buildNavigationNarratorPrompt(totalResult, newAccumulated, threshold, completed, useAbility)
      )
      if (narrative) {
        await supabase.from('messages').insert({
          session_id: session.id, character_id: 'narrator',
          content: narrative, type: 'narrator',
        })
        await advanceBeatIfNeeded()
      }
    } catch (err) {
      if (err instanceof ModelsBusyError) {
        await supabase.from('messages').insert({
          session_id: session.id, character_id: 'narrator',
          content: 'Los servidores están ocupados, inténtalo en unos minutos.', type: 'narrator',
        })
      }
    }
    setNarratorTyping(false)

    // Si completó el umbral, avisar al Director
    if (completed && onEventComplete) await onEventComplete()

    setSending(false)
  }

  // Sacrifica 1 HP del jugador activo para sumar 1 a navigation_accumulated
  async function sacrificeForNavigation() {
    if (sending) return
    const current = characterStatesRef.current.find(s => s.character_id === activeCharacter.id)
    if (!current || current.hp_current <= 0) return
    setSending(true)

    const newHp = Math.max(0, current.hp_current - 1)
    const isDying = newHp === 0
    await supabase.from('session_character_state')
      .update({ hp_current: newHp, ...(isDying ? { is_dead: true } : {}) })
      .eq('session_id', session.id).eq('character_id', activeCharacter.id)
    setCharacterStates(prev =>
      prev.map(s => s.character_id === activeCharacter.id ? { ...s, hp_current: newHp, ...(isDying ? { is_dead: true } : {}) } : s)
    )

    const data = gameModeData || {}
    const newAccumulated = (data.navigation_accumulated || 0) + 1
    const threshold = data.danger_threshold || 10
    const completed = newAccumulated >= threshold
    const newGameModeData = { ...data, navigation_accumulated: newAccumulated, ...(completed ? { options_visible: false } : {}) }

    if (completed) {
      await supabase.from('sessions').update({ game_mode: 'normal', game_mode_data: newGameModeData }).eq('id', session.id)
      setGameMode('normal'); gameModeRef.current = 'normal'
    } else {
      await supabase.from('sessions').update({ game_mode_data: newGameModeData }).eq('id', session.id)
    }
    setGameModeData(newGameModeData)

    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: `❤️ ${activeCharacter.name} sacrifica 1 de vida para avanzar. Navegación acumulada: ${newAccumulated}/${threshold}`,
      type: 'action',
    })

    if (completed && onEventComplete) await onEventComplete()
    setSending(false)
  }

  // Todos pierden 1 HP, el umbral baja 2 y todos vuelven a tirar
  async function riskyMove() {
    if (sending) return
    setSending(true); setNarratorTyping(true)

    const data = gameModeData || {}
    const activePlayers = presentIdsRef.current.length
    const currentThreshold = data.danger_threshold || 10
    const newThreshold = Math.max(1, currentThreshold - activePlayers)

    for (const id of presentIdsRef.current) {
      const state = characterStatesRef.current.find(s => s.character_id === id)
      if (!state || state.hp_current <= 0) continue
      const newHp = Math.max(0, state.hp_current - 1)
      await supabase.from('session_character_state')
        .update({ hp_current: newHp, ...(newHp === 0 ? { is_dead: true } : {}) })
        .eq('session_id', session.id).eq('character_id', id)
      setCharacterStates(prev =>
        prev.map(s => s.character_id === id ? { ...s, hp_current: newHp, ...(newHp === 0 ? { is_dead: true } : {}) } : s)
      )
    }

    const newGameModeData = {
      ...data,
      danger_threshold: newThreshold,
      navigation_rolls: [],
      all_players_rolled: false,
      options_visible: false,
      risky_move_used: true,
    }
    await supabase.from('sessions').update({ game_mode_data: newGameModeData }).eq('id', session.id)
    setGameModeData(newGameModeData)

    // Narrar el riesgo colectivo
    const chatHistory = messagesRef.current.slice(-5).map(m => {
      if (m.character_id === 'narrator') return `Narrador: ${m.content.slice(0, 150)}`
      return `${allCharacters.find(c => c.id === m.character_id)?.name || m.character_id}: ${m.content}`
    }).join('\n')
    const dangerName = data.danger_name || 'el peligro'
    try {
      const narrative = await callNarratorModel(NARRATOR_SYSTEM_PROMPT,
        `${buildStoryContext()}## Personajes en sesión\n${buildCharacterContext()}\n## Historial reciente\n${chatHistory}\n\n## Situación: ¡La tripulación se arriesga!\nEl grupo (${activePlayers} jugadores) decide jugársela ante ${dangerName}. Todos sufren daño pero el peligro cede ${activePlayers} puntos (nuevo umbral: ${newThreshold}). Ahora deben tirar de nuevo.\n${buildBeatContext()}\nNarra la tensión del riesgo colectivo. Termina pidiendo al primer jugador que tire.`)
      if (narrative) {
        await supabase.from('messages').insert({ session_id: session.id, character_id: 'narrator', content: narrative, type: 'narrator' })
        await advanceBeatIfNeeded()
      }
    } catch { /* silencioso */ }

    const nextId = getLeastActive()
    if (nextId) await supabase.from('sessions').update({ current_turn_character_id: nextId }).eq('id', session.id)
    setSending(false); setNarratorTyping(false)
  }

  // Falla la navegación, activa un combate. Al terminar el combate, se vuelve a navegación.
  async function turnBack() {
    if (sending) return
    setSending(true); setNarratorTyping(true)

    const navData = { ...(gameModeData || {}) }
    const enemies = await getEnemies({ difficulty: 'easy', count: 2, type: 'humano' })

    const combatGameModeData = {
      enemies: (enemies || []).map(e => ({ ...e, defeated: false, ability_used: false })),
      resume_navigation: navData, // se restaurará al acabar el combate
    }
    await supabase.from('sessions').update({ game_mode: 'combat', game_mode_data: combatGameModeData }).eq('id', session.id)
    setGameMode('combat'); setGameModeData(combatGameModeData); gameModeRef.current = 'combat'

    const enemyNames = (enemies || []).map(e => e.name).join(' y ') || 'enemigos'
    const dangerName = navData.danger_name || 'el peligro'
    const chatHistory = messagesRef.current.slice(-5).map(m => {
      if (m.character_id === 'narrator') return `Narrador: ${m.content.slice(0, 150)}`
      return `${allCharacters.find(c => c.id === m.character_id)?.name || m.character_id}: ${m.content}`
    }).join('\n')
    try {
      const narrative = await callNarratorModel(NARRATOR_SYSTEM_PROMPT,
        `${buildStoryContext()}## Personajes en sesión\n${buildCharacterContext()}\n## Historial reciente\n${chatHistory}\n\n## ¡Al dar la vuelta, encuentran enemigos!\nAl retroceder ante ${dangerName}, el grupo se topa con ${enemyNames}. ¡El combate es inevitable!\n${buildBeatContext()}\nNarra el giro dramático: al dar la vuelta aparecen ${enemyNames}. Combate inevitable. Pide a los jugadores que tiren iniciativa.`)
      if (narrative) {
        await supabase.from('messages').insert({ session_id: session.id, character_id: 'narrator', content: narrative, type: 'narrator' })
        await advanceBeatIfNeeded()
      }
    } catch { /* silencioso */ }

    setSending(false); setNarratorTyping(false)
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
    diceRequest, rollDice, rollInitiative, rollNavigation,
    sacrificeForNavigation, riskyMove, turnBack,
    characterStates, gameMode, gameModeData,
    startGame, announceEntry, debugAddItem,
    useItem, giftItem,
  }
}
