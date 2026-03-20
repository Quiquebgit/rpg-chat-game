import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { callMechanicsModel, callNarratorModel, ModelsBusyError } from '../lib/groq'
import { getRandomItem } from '../lib/items'
import { MECHANICS_SYSTEM_PROMPT, NARRATOR_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from '../lib/narrator'
import { characters as allCharacters } from '../data/characters'

const NARRATOR_CONTEXT_MESSAGES = 10
const SUMMARY_EVERY_N_MESSAGES = 10

export function useMessages(session, activeCharacter, presentIds = []) {
  // Ref para leer siempre la sesión más reciente en closures async
  const sessionRef = useRef(session)
  const [messages, setMessages] = useState([])
  const [characterStates, setCharacterStates] = useState([])
  const [sending, setSending] = useState(false)
  const [narratorTyping, setNarratorTyping] = useState(false)
  const [diceRequest, setDiceRequest] = useState({ required: false, count: 1 })
  const [narrativeSummary, setNarrativeSummary] = useState(session?.narrative_summary || '')
  // Estado local de modo de juego — se actualiza inmediatamente sin esperar Realtime
  const [gameMode, setGameMode] = useState(session?.game_mode || 'normal')
  const [gameModeData, setGameModeData] = useState(session?.game_mode_data ?? null)
  const subscriptionRef = useRef(null)
  const characterStatesSubRef = useRef(null)
  const messagesRef = useRef([])
  const characterStatesRef = useRef([])
  const presentIdsRef = useRef(presentIds)
  const narrativeSummaryRef = useRef(session?.narrative_summary || '')
  // Refs dedicados para game_mode y game_mode_data — fuente de verdad para los prompts
  const gameModeRef = useRef(session?.game_mode || 'normal')
  const gameModeDataRef = useRef(session?.game_mode_data ?? null)
  // Guarda el resultado del modelo mecánico mientras el jugador tira los dados
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
    gameModeDataRef.current = session?.game_mode_data ?? null
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

  // Suscribirse a cambios de vida e inventario para actualizar el panel lateral en tiempo real
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

  // --- Helpers ---

  // Contexto completo para el narrador (con inventario y habilidad)
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

  // Contexto mínimo para el modelo mecánico (solo stats, sin inventario ni historial)
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

  // Devuelve el personaje presente con menos intervenciones recientes
  function getLeastActive() {
    const activeIds = presentIdsRef.current
    const recentMessages = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES)
    const counts = Object.fromEntries(activeIds.map(id => [id, 0]))
    for (const m of recentMessages) {
      if (m.character_id in counts) counts[m.character_id]++
    }
    return [...activeIds].sort((a, b) => counts[a] - counts[b])[0]
  }

  // JSON por defecto si el modelo mecánico falla — pasa el turno sin efectos
  function getDefaultMechanics() {
    const leastActive = getLeastActive()
    return {
      dice_required: false, dice_count: 1, dice_stat: null, dice_threshold: null,
      next_character_id: leastActive || presentIdsRef.current[0] || null,
      stat_updates: [], inventory_updates: [], enemy_updates: [],
      game_mode: null, game_mode_data: null,
      event_type: null, session_event: null,
    }
  }

  // Contexto del modo de juego actual para los prompts del modelo mecánico
  // Lee de los refs dedicados para tener siempre datos frescos (no Realtime delayed)
  function buildGameModeContext() {
    const mode = gameModeRef.current
    const data = gameModeDataRef.current
    if (!mode || mode === 'normal') return ''
    if (mode === 'combat' && data?.enemies) {
      // Pasar solo enemigos VIVOS al modelo — los muertos no deben aparecer en el contexto
      const alive = data.enemies.filter(e => !e.defeated)
      if (!alive.length) return ''
      const cleanData = { ...data, enemies: alive }
      return `## Modo de juego activo: combat\n${JSON.stringify(cleanData)}\nEnemigos vivos (usa estos ids exactos en enemy_updates): ${alive.map(e => `${e.id}(${e.name} HP:${e.hp})`).join(', ')}\n`
    }
    return `## Modo de juego activo: ${mode}\n${data ? JSON.stringify(data) : ''}\n`
  }

  // Prompt mínimo para el modelo mecánico (sin historial ni resumen de sesión)
  function buildMechanicsPrompt(playerAction) {
    const leastActive = getLeastActive()
    return `Activo:${activeCharacter.id}(ATK${activeCharacter.attack} DEF${activeCharacter.defense} NAV${activeCharacter.navigation})
Acción: ${playerAction}
Personajes: ${buildMinimalCharContext()}
${buildGameModeContext()}next:${leastActive} no_rep:${activeCharacter.id}`
  }

  // Prompt mínimo para instrucciones GM
  function buildGmMechanicsPrompt(instruction) {
    const leastActive = getLeastActive()
    return `GM(${activeCharacter.id}): ${instruction}
Personajes: ${buildMinimalCharContext()}
${buildGameModeContext()}next:${leastActive}
"yo/me/mi/dame"→${activeCharacter.id} | combat:enemies obligatorio | game_mode_data completo si activa modo`
  }

  // Prompt para el modelo narrador: contexto completo + JSON mecánico ya resuelto
  function buildNarratorPrompt(playerAction, mechanics, diceResult, realNextId = null, attackPreview = null) {
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

    const attackNote = attackPreview
      ? `## Resultado del ataque (calculado):\n${attackPreview.enemyName} recibe ${attackPreview.damage} de daño: HP ${attackPreview.oldHp}→${attackPreview.newHp}${attackPreview.willBeDefeated ? ' (DERROTADO)' : ''}.${attackPreview.allWillFall ? ' TODOS LOS ENEMIGOS HAN CAÍDO. Narra el FIN del combate y la calma.' : ''}\n`
      : ''

    return `## Personajes en sesión
${buildCharacterContext()}
${summary ? `## Resumen de la sesión\n${summary}\n` : ''}${buildGameModeContext()}## Historial reciente
${chatHistory}

## Acción de ${activeCharacter.name}:
${playerAction}
${diceResult ? `## Resultado de dados:\n${diceResult}${mechanics.dice_threshold ? ` (umbral para éxito: ${mechanics.dice_threshold})` : ''}\n` : ''}${attackNote}## Decisiones mecánicas (ya resueltas — nárralas):
${JSON.stringify(mechanics)}

Termina interpelando a: ${nextChar?.name || nextId}`
  }

  // --- Aplicar efectos mecánicos ---

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

  // --- Motor principal de dos modelos ---

  // Paso 1: modelo mecánico determina qué pasa
  // Paso 2: modelo narrador cuenta cómo ocurre
  async function processAction(playerAction, { isGm = false, gmInstruction = null } = {}) {
    setNarratorTyping(true)
    // Modelo mecánico
    let mechanics = getDefaultMechanics()
    try {
      const mechanicsPrompt = isGm && gmInstruction
        ? buildGmMechanicsPrompt(gmInstruction)
        : buildMechanicsPrompt(playerAction)
      const estSystem = Math.round(MECHANICS_SYSTEM_PROMPT.length / 4)
      const estUser = Math.round(mechanicsPrompt.length / 4)
      console.log(`[tokens mecánico] system:~${estSystem} user:~${estUser} total:~${estSystem + estUser}`)
      const raw = await callMechanicsModel(MECHANICS_SYSTEM_PROMPT, mechanicsPrompt, { useTools: true })
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

    // Correcciones de turno en código (no depender solo del modelo)
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
        // El GM no necesita pulsar botón — tira automáticamente
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

    await deliverNarrative(playerAction, mechanics, null, { gmInstruction })
    setNarratorTyping(false)
  }

  // Detecta personajes que han llegado a 0 HP y los marca como muertos
  async function checkAndMarkDeaths(statUpdates) {
    for (const { character_id, hp_delta } of statUpdates) {
      if (hp_delta >= 0) continue
      const state = characterStatesRef.current.find(s => s.character_id === character_id)
      if (state && state.hp_current + hp_delta <= 0 && !state.is_dead) {
        await supabase.from('session_character_state')
          .update({ is_dead: true })
          .eq('session_id', session.id).eq('character_id', character_id)
        setCharacterStates(prev =>
          prev.map(s => s.character_id === character_id ? { ...s, is_dead: true } : s)
        )
      }
    }
  }

  // Aplica daño a enemigos en game_mode_data; si todos caen, vuelve a modo normal.
  // Lee de gameModeDataRef (fuente de verdad local, siempre al día) en vez de Supabase.
  async function applyEnemyUpdates(enemyUpdates) {
    if (!enemyUpdates?.length) return null

    const currentData = gameModeDataRef.current
    const enemies = currentData?.enemies
    console.log('[applyEnemyUpdates] enemigos en ref:', JSON.stringify(enemies))
    console.log('[applyEnemyUpdates] updates recibidos:', JSON.stringify(enemyUpdates))

    if (!enemies?.length) {
      console.warn('[applyEnemyUpdates] sin enemigos en ref — abortando')
      return null
    }

    // Normalización segura: convierte a string antes de operar (soporta números e undefined)
    const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    // El modelo a veces usa "character_id" en lugar de "enemy_id" — aceptar ambos
    const getUid = u => u.enemy_id ?? u.character_id

    // Solo atacar UN enemigo vivo por turno (single-target por defecto).
    // Calculamos el daño nosotros para no depender del hp_delta del modelo (suele ser incorrecto).
    let targetFound = false
    const updatedEnemies = enemies.map(enemy => {
      if (targetFound || enemy.defeated) return enemy  // ya atacado o ya muerto

      // Buscar update: id exacto (números y strings) → fuzzy → substring
      let update = enemyUpdates.find(u => {
        const uid = getUid(u)
        return uid === enemy.id || String(uid) === String(enemy.id)
      })
      if (!update) {
        update = enemyUpdates.find(u => {
          const uid = getUid(u)
          return norm(uid) === norm(enemy.id) ||
            norm(uid) === norm(enemy.name) ||
            norm(String(enemy.id)).includes(norm(String(uid))) ||
            norm(String(uid)).includes(norm(String(enemy.id)))
        })
        if (update) console.log(`[applyEnemyUpdates] match fuzzy: "${getUid(update)}" → "${enemy.name}"`)
      }
      if (!update) return enemy

      targetFound = true
      // Calcular daño con la fórmula correcta: max(1, ATK_atacante - DEF_enemigo)
      const damage = Math.max(0, activeCharacter.attack - enemy.defense)
      const newHp = Math.max(0, enemy.hp - damage)
      console.log(`[applyEnemyUpdates] ${enemy.name}: ATK${activeCharacter.attack} - DEF${enemy.defense} = ${damage} daño → HP ${enemy.hp}→${newHp}`)
      return { ...enemy, hp: newHp, defeated: newHp <= 0 }
    })

    const allDefeated = updatedEnemies.every(e => e.defeated)
    const newMode = allDefeated ? 'normal' : 'combat'
    const newData = allDefeated ? null : { ...currentData, enemies: updatedEnemies }

    console.log('[applyEnemyUpdates] resultado:', newMode, JSON.stringify(newData?.enemies))

    await supabase.from('sessions')
      .update({ game_mode: newMode, game_mode_data: newData })
      .eq('id', session.id)

    // Actualizar estado local y refs inmediatamente (sin esperar Realtime)
    setGameMode(newMode)
    setGameModeData(newData)
    gameModeRef.current = newMode
    gameModeDataRef.current = newData
    sessionRef.current = { ...sessionRef.current, game_mode: newMode, game_mode_data: newData }

    return { newMode, newData }
  }

  // Actualiza el modo de juego en Supabase con los datos del modelo mecánico
  async function applyGameMode(mechanics) {
    const newMode = mechanics.game_mode
    let newData = mechanics.game_mode_data
    if (!newMode) return

    const currentMode = gameModeRef.current || 'normal'

    // Si ya estamos en combat, no sobrescribir game_mode_data — enemy_updates lo gestiona
    if (newMode === 'combat' && currentMode === 'combat') {
      console.log('[applyGameMode] ya en combat, ignorando game_mode_data para no pisar enemy_updates')
      return
    }

    // Al entrar en combat: normalizar hp=hp_max, y garantizar que hp_max quede guardado
    if (newMode === 'combat' && newData?.enemies) {
      newData = {
        ...newData,
        enemies: newData.enemies.map(e => {
          const maxHp = (e.hp_max > 0 ? e.hp_max : null) ?? (e.hp > 0 ? e.hp : 5)
          return { ...e, hp: maxHp, hp_max: maxHp, defeated: false }
        }),
      }
    }
    console.log('[applyGameMode] modo:', newMode, '| enemigos:', JSON.stringify(newData?.enemies))

    await supabase.from('sessions')
      .update({ game_mode: newMode, game_mode_data: newData })
      .eq('id', session.id)

    // Actualizar estado local y refs inmediatamente (sin esperar Realtime)
    setGameMode(newMode)
    setGameModeData(newData)
    gameModeRef.current = newMode
    gameModeDataRef.current = newData
    sessionRef.current = { ...sessionRef.current, game_mode: newMode, game_mode_data: newData }
  }

  // Calcula el resultado del ataque actual ANTES de narrar, para que el narrador lo sepa
  function previewCombatAttack(enemyUpdates) {
    if (!enemyUpdates?.length || gameModeRef.current !== 'combat') return null
    const enemies = gameModeDataRef.current?.enemies
    if (!enemies?.length) return null
    const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const getUid = u => u.enemy_id ?? u.character_id
    for (const enemy of enemies) {
      if (enemy.defeated) continue
      const update = enemyUpdates.find(u => {
        const uid = getUid(u)
        return uid === enemy.id || String(uid) === String(enemy.id) ||
          norm(uid) === norm(enemy.id) || norm(uid) === norm(enemy.name)
      })
      if (update) {
        const damage = Math.max(0, activeCharacter.attack - enemy.defense)
        const newHp = Math.max(0, enemy.hp - damage)
        const willBeDefeated = damage > 0 && newHp <= 0
        const allWillFall = willBeDefeated &&
          enemies.every(e => e.defeated || e.id === enemy.id)
        return { enemyName: enemy.name, oldHp: enemy.hp, newHp, damage, willBeDefeated, allWillFall }
      }
    }
    return null
  }

  // Distribuye botín automáticamente al terminar el combate (el modelo no sabe cuándo termina)
  async function distributeLoot() {
    const lootUpdates = []
    for (const id of presentIdsRef.current) {
      const roll = Math.random()
      if (roll > 0.3) {  // 70% de probabilidad de loot
        const rarity = roll > 0.85 ? 'raro' : 'común'
        const types = ['arma', 'equipo', 'consumible']
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

  // Calcula el siguiente turno real respetando el orden de combate y filtrando muertos
  function computeNextTurn(mechanics) {
    const s = sessionRef.current
    const aliveIds = presentIdsRef.current.filter(
      id => !characterStatesRef.current.find(cs => cs.character_id === id)?.is_dead
    )
    let nextId = mechanics.next_character_id
    if (s?.game_mode === 'combat' && s.game_mode_data?.combat_turn_order?.length > 0) {
      const order = s.game_mode_data.combat_turn_order.filter(id => aliveIds.includes(id))
      const currentIdx = order.indexOf(s.current_turn_character_id)
      nextId = order[(currentIdx + 1) % order.length] || nextId
    }
    if (nextId && characterStatesRef.current.find(cs => cs.character_id === nextId)?.is_dead) {
      nextId = aliveIds.find(id => id !== activeCharacter.id) || aliveIds[0] || nextId
    }
    return nextId
  }

  // Llama al modelo narrador con todo el contexto y aplica los efectos
  async function deliverNarrative(playerAction, mechanics, diceResult, { gmInstruction = null } = {}) {
    // Calcular el turno real y el resultado del ataque ANTES de narrar (para que el narrador lo sepa)
    const realNextId = computeNextTurn(mechanics)
    const attackPreview = previewCombatAttack(mechanics.enemy_updates)
    const systemPrompt = gmInstruction
      ? `${NARRATOR_SYSTEM_PROMPT}\n\n## INSTRUCCIÓN ACTIVA DEL GM — PRIORIDAD ABSOLUTA:\n${gmInstruction}\nEjecuta exactamente lo que pide. No la ignores ni la suavices.`
      : NARRATOR_SYSTEM_PROMPT
    let narrative
    try {
      narrative = await callNarratorModel(systemPrompt, buildNarratorPrompt(playerAction, mechanics, diceResult, realNextId, attackPreview))
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
      session_id: session.id,
      character_id: 'narrator',
      content: narrative,
      type: 'narrator',
    })

    // En combate: recalcular daño de contraataque con la fórmula correcta (mín 0)
    // para no depender del valor incorrecto que envía el modelo
    let statUpdates = mechanics.stat_updates || []
    if (gameModeRef.current === 'combat' && statUpdates.length > 0) {
      const aliveEnemies = gameModeDataRef.current?.enemies?.filter(e => !e.defeated) || []
      statUpdates = statUpdates.map(upd => {
        if (upd.character_id === activeCharacter.id && upd.hp_delta < 0 && aliveEnemies.length > 0) {
          const totalDamage = aliveEnemies.reduce(
            (sum, e) => sum + Math.max(0, e.attack - activeCharacter.defense), 0
          )
          return totalDamage > 0 ? { ...upd, hp_delta: -totalDamage } : null
        }
        return upd
      }).filter(Boolean)
    }
    if (statUpdates.length > 0) {
      await applyStatUpdates(statUpdates)
      await checkAndMarkDeaths(statUpdates)
    }
    if (mechanics.inventory_updates?.length > 0) await applyInventoryUpdates(mechanics.inventory_updates)
    const enemyResult = mechanics.enemy_updates?.length > 0 ? await applyEnemyUpdates(mechanics.enemy_updates) : null
    // No aplicar game_mode si el combate terminó por derrota de todos los enemigos en este mismo turno
    if (mechanics.game_mode && enemyResult?.newMode !== 'normal') await applyGameMode(mechanics)
    // Distribuir botín automáticamente cuando termina el combate
    if (enemyResult?.newMode === 'normal') await distributeLoot()

    // Asignar el siguiente turno (ya calculado antes de narrar para coherencia)
    if (realNextId && presentIdsRef.current.includes(realNextId)) {
      await supabase.from('sessions')
        .update({ current_turn_character_id: realNextId })
        .eq('id', session.id)
    }

    // Actualizar resumen cada N mensajes de jugador (solo el cliente activo lo dispara)
    const playerMessages = messagesRef.current.filter(m => m.type === 'player' || m.type === 'action')
    if (playerMessages.length > 0 && playerMessages.length % SUMMARY_EVERY_N_MESSAGES === 0) {
      updateNarrativeSummary()
    }
  }

  // --- Acciones del jugador ---

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

  // Acción de emote (/acción): visible para todos, activa al narrador si es tu turno
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

  // Mensaje de conversación: visible para todos, no activa al narrador
  async function sendChat(content) {
    if (!content.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: content.trim(), type: 'player',
    })
    setSending(false)
  }

  // Instrucción al narrador (/gm): pasa por el modelo mecánico (dados, items, etc.)
  // pero la instrucción va en el system prompt del narrador para prioridad absoluta
  async function sendGmMessage(instruction) {
    if (!instruction.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: instruction.trim(), type: 'gm',
    })
    await processAction(`[Instrucción del maestro de juego: ${instruction.trim()}]`, { isGm: true, gmInstruction: instruction.trim() })
    setSending(false)
  }

  // Tirada de dados: genera resultado, lo guarda y entrega la narrativa con el contexto mecánico pendiente
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

  // Inicio manual de partida — con check de race condition
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

  // Anunciar entrada de un personaje que llega a la sesión en curso
  async function announceEntry() {
    if (sending) return
    setSending(true)
    await supabase.from('messages').insert({
      session_id: session.id, character_id: activeCharacter.id,
      content: `${activeCharacter.name} entra en la sala.`, type: 'action',
    })
    setSending(false)
  }

  // Resumen incremental: modelo mecánico (8b) para coste mínimo
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
      const summary = await callMechanicsModel(SUMMARY_SYSTEM_PROMPT, userContent, { json: false, maxTokens: 200, temperature: 0.3 })
      if (!summary) return
      setNarrativeSummary(summary)
      await supabase.from('sessions').update({ narrative_summary: summary }).eq('id', session.id)
    } catch (err) {
      console.error('Error actualizando resumen narrativo:', err)
    }
  }

  // Tirada de iniciativa: 1d6 + ataque. Cada jugador la hace manualmente al inicio del combate.
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

    // Registrar iniciativa en game_mode_data
    const currentData = s.game_mode_data || {}
    const initiative = { ...(currentData.initiative || {}), [activeCharacter.id]: roll }
    const updatedData = { ...currentData, initiative }

    // Si todos los presentes han tirado, establecer el orden de turno de combate
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
    gameModeDataRef.current = updatedData
    sessionRef.current = { ...sessionRef.current, game_mode_data: updatedData }
    setSending(false)
  }

  // Solo en desarrollo — añade un item de prueba al inventario del personaje activo
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

  return { messages, sending, narratorTyping, sendMessage, sendChat, sendAction, sendGmMessage, diceRequest, rollDice, rollInitiative, characterStates, gameMode, gameModeData, startGame, announceEntry, debugAddItem }
}
