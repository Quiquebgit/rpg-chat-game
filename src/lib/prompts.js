// Constructores de prompts para el narrador y el modelo mecánico.
// Usa el patrón factory: recibe refs y activeCharacter para que las funciones
// accedan a .current en el momento de la llamada, igual que en el hook original.

import { characters as allCharacters } from '../data/characters'

const NARRATOR_CONTEXT_MESSAGES = 10

export function createPromptBuilders({ activeCharacter, presentIdsRef, characterStatesRef, messagesRef, narrativeSummaryRef, sessionRef, currentEventSetupRef }) {

  // ─── Contexto de personajes ────────────────────────────────────────────────

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

  // Contexto compacto del evento activo para el modelo mecánico
  function buildEventContext() {
    const briefing = sessionRef.current?.current_event_briefing
    const setup = currentEventSetupRef?.current
    if (!briefing && !setup) return ''

    const eventType = setup?.type
    const isCombatEvent = eventType === 'combat' || eventType === 'boss'
    const isNavEvent = eventType === 'navigation'

    // Instrucción explícita según tipo — cuanto más directa, mejor para el modelo
    let header = '## Evento actual'
    if (isCombatEvent) {
      header += ' — ACTIVA game_mode:"combat" con getEnemies() AHORA si el modo es normal. No esperes.'
    } else if (isNavEvent) {
      header += ' — ACTIVA game_mode:"navigation" si el modo aún es normal'
    } else {
      header += ' — activa el modo de juego correspondiente si no está activo'
    }

    let ctx = `${header}\n`
    if (briefing) ctx += `${briefing}\n`

    // Parámetros de enemigos del template si existen (guían los args de getEnemies)
    if (isCombatEvent && (setup?.enemy_difficulty || setup?.enemy_count || setup?.enemy_type)) {
      ctx += `Usa getEnemies con: difficulty:${setup.enemy_difficulty || 'medium'} count:${setup.enemy_count || 2} type:${setup.enemy_type || 'cualquiera'}\n`
    }

    return ctx
  }

  // Últimos mensajes del narrador para dar contexto de escena al modelo mecánico
  function buildRecentNarratorContext() {
    const lastNarrator = messagesRef.current
      .filter(m => m.character_id === 'narrator')
      .slice(-2)
      .map(m => m.content.length > 300 ? m.content.slice(0, 300) + '…' : m.content)
      .join('\n---\n')
    return lastNarrator ? `## Contexto de escena (últimos mensajes del narrador)\n${lastNarrator}\n` : ''
  }

  // Items equipados y frutas activas del jugador activo — solo lo que afecta mecánicamente
  function buildActiveInventoryContext() {
    const state = characterStatesRef.current.find(s => s.character_id === activeCharacter.id)
    const inv = state?.inventory || []
    const active = inv.filter(i => (i.equippable && i.equipped) || i.is_fruit)
    if (!active.length) return ''
    const lines = active.map(i => {
      const effects = i.effects?.map(e => `${e.stat}${e.modifier > 0 ? '+' : ''}${e.modifier}`).join(' ') || ''
      const ability = i.special_ability ? ` ✦${i.special_ability.slice(0, 60)}` : ''
      return `  - ${i.name}${effects ? ` [${effects}]` : ''}${ability}`
    }).join('\n')
    return `## Equipo activo de ${activeCharacter.id}\n${lines}\n`
  }

  // Beat actual del Director: objetivo concreto que el narrador debe alcanzar en este turno
  function buildBeatContext() {
    const s = sessionRef.current
    const beats = s?.current_beats
    if (!beats?.length) return ''
    const index = s.current_beat_index ?? 0
    const turnsUsed = s.current_beat_turns_used ?? 0
    if (index >= beats.length) return ''
    const beat = beats[index]
    const remaining = beat.max_turns - turnsUsed
    const warning = remaining <= 1
      ? `⚠️ ÚLTIMO TURNO de este beat — ciérralo ya y lleva la situación al siguiente nivel.`
      : `Tienes ${remaining - 1} turno${remaining - 1 !== 1 ? 's' : ''} más después de este para alcanzarlo.`
    return `\n## Objetivo narrativo de este turno (obligatorio)\n"${beat.goal}"\n${warning}\n`
  }

  // ─── Prompts del modelo mecánico ──────────────────────────────────────────

  // Prompt del modelo mecánico en modo combate (solo intenciones)
  function buildCombatMechanicsPrompt(playerAction, currentGameModeData) {
    const alive = currentGameModeData?.enemies?.filter(e => !e.defeated) || []
    const stunned = characterStatesRef.current.filter(s => s.stunned).map(s => s.character_id)
    const currentState = characterStatesRef.current.find(s => s.character_id === activeCharacter.id)
    const ability = activeCharacter.ability
    const abilityUsed = currentState?.combat_ability_used ?? false
    const firstDone = currentState?.first_attack_done ?? false
    const abilityStatus = ability
      ? ` [${ability.name}(${ability.type})${abilityUsed ? ':USADA' : firstDone ? ':PRIMERA_YA' : ':disponible'}]`
      : ''
    // Frutas activas e inmunidades del jugador activo
    const inv = currentState?.inventory || []
    const fruits = inv.filter(i => i.is_fruit || (i.type === 'fruta' && i.equipped))
    const immuneLines = fruits.flatMap(f => f.immune_to || []).filter(Boolean)
    const specialLines = fruits.map(f => f.special_effect?.type).filter(Boolean)
    const fruitsCtx = fruits.length
      ? `Frutas activas: ${fruits.map(f => f.name).join(', ')}${immuneLines.length ? ` | inmune a: ${immuneLines.join(',')}` : ''}${specialLines.length ? ` | especiales: ${specialLines.join(',')}` : ''}\n`
      : ''
    return `Activo:${activeCharacter.id}${abilityStatus}
Acción: ${playerAction}
Personajes: ${buildMinimalCharContext()}
${buildActiveInventoryContext()}${fruitsCtx}Enemigos vivos: ${alive.map(e => `"${e.name}"(HP:${e.hp} tipos:${(e.attack_type||['physical']).join('+')})`).join(', ') || 'ninguno'}
${stunned.length ? `Aturdidos (pierden turno): ${stunned.join(', ')}\n` : ''}next:${getLeastActive()} no_rep:${activeCharacter.id}`
  }

  // Prompt del modelo mecánico fuera de combate
  function buildMechanicsPrompt(playerAction, currentGameModeData, currentGameMode) {
    const leastActive = getLeastActive()
    return `Activo:${activeCharacter.id}(ATK${activeCharacter.attack} DEF${activeCharacter.defense} NAV${activeCharacter.navigation})
Acción: ${playerAction}
Personajes: ${buildMinimalCharContext()}
${buildActiveInventoryContext()}${buildRecentNarratorContext()}${buildGameModeContext(currentGameModeData, currentGameMode)}${buildEventContext()}next:${leastActive} no_rep:${activeCharacter.id}`
  }

  function buildGmMechanicsPrompt(instruction, currentGameModeData, currentGameMode) {
    const leastActive = getLeastActive()
    return `GM(${activeCharacter.id}): ${instruction}
Personajes: ${buildMinimalCharContext()}
${buildActiveInventoryContext()}${buildRecentNarratorContext()}${buildGameModeContext(currentGameModeData, currentGameMode)}${buildEventContext()}REGLA: si la instrucción implica combate, llama getEnemies() y pon game_mode:"combat" ahora mismo.
next:${leastActive}
"yo/me/mi/dame"→${activeCharacter.id} | combat:usa getEnemies() | game_mode_data completo si activa modo`
  }

  // ─── Prompts del narrador ─────────────────────────────────────────────────

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
${buildBeatContext()}
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
${buildBeatContext()}
Termina interpelando a: ${nextChar?.name || nextId}`
  }

  // Prompt del modelo mecánico en modo negociación (evalúa conviction_delta)
  function buildNegotiationMechanicsPrompt(playerAction, gameModeData) {
    const { npc_name, npc_attitude, conviction, conviction_max } = gameModeData || {}
    return `NPC: ${npc_name || 'desconocido'} (actitud: ${npc_attitude || 'neutral'})
Convicción: ${conviction ?? 0}/${conviction_max ?? 10}
Personajes: ${buildMinimalCharContext()}
Acción de ${activeCharacter.id}: ${playerAction}
next:${getLeastActive()} no_rep:${activeCharacter.id}`
  }

  // Prompt para el narrador-NPC en negociación (primera persona, sin ambientación)
  function buildNpcNarratorPrompt(playerAction, gameModeData) {
    const { npc_name, npc_attitude, conviction, conviction_max } = gameModeData || {}
    const convMax = conviction_max ?? 10
    const conv = conviction ?? 0
    const convNote = conv <= 2
      ? 'Estás muy escéptico y a punto de cortar la conversación.'
      : conv >= convMax - 2
      ? 'Casi te han convencido, aunque te resistes a mostrarlo.'
      : 'Escuchas con cautela.'
    // Últimos 6 mensajes para dar contexto al NPC
    const recentHistory = messagesRef.current.slice(-6).map(m => {
      if (m.type === 'npc') return `${m.character_id}: ${m.content}`
      if (m.character_id === 'narrator') {
        return `(escena): ${m.content.slice(0, 80)}…`
      }
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')
    return `Eres ${npc_name || 'el NPC'} (actitud: ${npc_attitude || 'neutral'}). ${convNote}

Historial reciente:
${recentHistory}

${activeCharacter.name} dice/hace: ${playerAction}

Responde en primera persona como ${npc_name || 'el NPC'}. Máx. 3 frases cortas.`
  }

  // Prompt del narrador para tiradas de navegación
  function buildNavigationNarratorPrompt(rollTotal, accumulated, threshold, completed, usedAbility) {
    const summary = narrativeSummaryRef.current
    const chatHistory = messagesRef.current.slice(-NARRATOR_CONTEXT_MESSAGES).map(m => {
      if (m.character_id === 'narrator') {
        const text = m.content.length > 200 ? m.content.slice(0, 200) + '…' : m.content
        return `Narrador: ${text}`
      }
      const name = allCharacters.find(c => c.id === m.character_id)?.name || m.character_id
      return `${name}: ${m.content}`
    }).join('\n')

    return `${buildStoryContext()}## Personajes en sesión
${buildCharacterContext()}
${summary ? `## Resumen de la sesión\n${summary}\n` : ''}## Historial reciente
${chatHistory}

## Tirada de navegación de ${activeCharacter.name}
Resultado: ${rollTotal}${usedAbility ? ` (incluye ${activeCharacter.ability.name} de ${activeCharacter.name}, +${activeCharacter.ability?.effect?.value ?? activeCharacter.ability?.value ?? 0})` : ''}
Progreso acumulado: ${accumulated} / ${threshold}
${completed ? '✅ ¡Umbral superado! La navegación fue un éxito — el peligro ha sido superado.' : `Falta ${threshold - accumulated} punto${threshold - accumulated !== 1 ? 's' : ''} para superar el umbral.`}
${buildBeatContext()}
Narra la tirada de forma dramática. ${completed ? 'El peligro ha sido superado — narra el éxito y la calma que llega.' : 'El peligro aún acecha, describe cómo el grupo avanza pero la amenaza sigue presente.'}
Termina interpelando al siguiente personaje.`
  }

  return {
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
    buildNegotiationMechanicsPrompt,
    buildNpcNarratorPrompt,
  }
}
