// Función pura: calcula el resultado de un turno de combate.
// No lee ni escribe nada en Supabase — eso lo hace useMessages.js.
// Recibe el estado actual y devuelve el resultado + las escrituras pendientes.

// Normalización para buscar enemigos por nombre (fuzzy match)
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Busca el enemigo objetivo por nombre en la lista de vivos.
// Prioridad: coincidencia exacta → substring → primer vivo si no hay match.
function findTarget(targetName, aliveEnemies) {
  if (!aliveEnemies.length) return null
  if (!targetName) return aliveEnemies[0]

  const t = norm(targetName)
  const exact = aliveEnemies.find(e => norm(e.name) === t)
  if (exact) return exact

  const sub = aliveEnemies.find(e => norm(e.name).includes(t) || t.includes(norm(e.name)))
  return sub || aliveEnemies[0]
}

// Comprueba si la habilidad del enemigo se activa en este turno.
// hpBefore: HP antes de recibir el daño del jugador.
function shouldTriggerAbility(enemy, hpBefore) {
  const ability = enemy.ability
  if (!ability) return false

  switch (ability.trigger) {
    case 'hp_below_half':
      // Se activa cuando el HP cruza la mitad (antes estaba por encima, ahora por debajo)
      return hpBefore > enemy.hp_max / 2 && enemy.hp <= enemy.hp_max / 2
    case 'first_turn':
      return !enemy.ability_used
    case 'every_turn':
      return true
    case 'random':
      return Math.random() < (ability.chance ?? 0.25)
    default:
      return false
  }
}

// Calcula el daño de contraataque base del enemigo al jugador activo.
function baseCounterattack(enemy, activeCharacter) {
  return Math.max(0, enemy.attack - activeCharacter.defense)
}

// Aplica el efecto de la habilidad sobre el contraataque y devuelve los efectos adicionales.
// Retorna: { counterDamage, healAmount, aoeActive, stunActive, poisonActive }
function resolveAbilityEffect(ability, enemy, activeCharacter, allAliveChars) {
  const baseDmg = baseCounterattack(enemy, activeCharacter)

  switch (ability.effect) {
    case 'double_attack':
      return { counterDamage: baseDmg * 2, healAmount: 0, aoeActive: false, stunActive: false, poisonActive: false }

    case 'aoe_attack':
      // El daño del contraataque se aplica a TODOS los jugadores vivos (calculado por jugador fuera)
      return { counterDamage: baseDmg, healAmount: 0, aoeActive: true, stunActive: false, poisonActive: false }

    case 'heal': {
      // El enemigo se cura Math.ceil(hp_max * 0.20), mínimo 1
      const healAmount = Math.max(1, Math.ceil(enemy.hp_max * 0.20))
      return { counterDamage: baseDmg, healAmount, aoeActive: false, stunActive: false, poisonActive: false }
    }

    case 'stun':
      // Contraataque normal pero el jugador pierde su próximo turno
      return { counterDamage: baseDmg, healAmount: 0, aoeActive: false, stunActive: true, poisonActive: false }

    case 'poison':
      // Contraataque normal + 1 daño extra de veneno
      return { counterDamage: baseDmg + 1, healAmount: 0, aoeActive: false, stunActive: false, poisonActive: true }

    default:
      return { counterDamage: baseDmg, healAmount: 0, aoeActive: false, stunActive: false, poisonActive: false }
  }
}

// ─────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────

export function resolveCombatTurn({
  mechanics,        // { player_intent, target_enemy_name, target_ally_id, use_special_ability, is_action, next_character_id }
  activeCharacter,  // { id, name, attack, defense, hp, ability }
  gameModeData,     // { enemies: [...], combat_turn_order: [...], stunned: [...], ... }
  characterStates,  // [{ character_id, hp_current, is_dead }]
  presentIds,       // ['shin', 'darro']
  currentTurnId,    // session.current_turn_character_id
}) {
  const enemies = gameModeData?.enemies || []
  const aliveEnemies = enemies.filter(e => !e.defeated)

  const currentState = characterStates.find(s => s.character_id === activeCharacter.id)
  const currentPlayerHp = currentState?.hp_current ?? activeCharacter.hp

  // ── Comprobar si el jugador activo está aturdido ──────────────────────────
  const stunned = gameModeData?.stunned || []
  if (stunned.includes(activeCharacter.id)) {
    // Pierde el turno sin acción
    const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, false)
    const newGameModeData = { ...gameModeData, stunned: stunned.filter(id => id !== activeCharacter.id) }
    return {
      combatResult: {
        attacker: activeCharacter.name,
        attacker_id: activeCharacter.id,
        skipped_turn: true,
        target: null, damage_dealt: 0,
        enemy_hp_before: null, enemy_hp_after: null, enemy_dead: false,
        all_enemies_dead: false,
        counterattack_damage: 0, counterattack_enemy: null,
        attacker_hp_before: currentPlayerHp, attacker_hp_after: currentPlayerHp,
        attacker_dead: false,
        aoe_targets: [],
        enemy_ability_triggered: null,
        next_character: nextTurnId,
        remaining_enemies: aliveEnemies.map(e => e.name),
      },
      newGameModeData,
      newMode: 'combat',
      playerUpdates: [],
      aoeUpdates: [],
      nextTurnId,
      defeatedEnemies: [],
    }
  }

  // ── Acción de curación (Vela, etc.) ──────────────────────────────────────
  if (mechanics.player_intent === 'heal' || (!mechanics.is_action && mechanics.player_intent !== 'attack')) {
    const healTargetId = mechanics.target_ally_id || activeCharacter.id
    const healTarget = characterStates.find(s => s.character_id === healTargetId)
    const healChar = { id: healTargetId, hp: activeCharacter.hp }  // fallback
    const maxHp = healChar.hp
    const oldHp = healTarget?.hp_current ?? maxHp
    const newHp = Math.min(maxHp, oldHp + 2)
    const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, false)

    return {
      combatResult: {
        attacker: activeCharacter.name,
        attacker_id: activeCharacter.id,
        skipped_turn: false,
        target: null, damage_dealt: 0,
        enemy_hp_before: null, enemy_hp_after: null, enemy_dead: false,
        all_enemies_dead: false,
        counterattack_damage: 0, counterattack_enemy: null,
        attacker_hp_before: currentPlayerHp, attacker_hp_after: currentPlayerHp,
        attacker_dead: false,
        aoe_targets: [],
        enemy_ability_triggered: null,
        heal_target: healTargetId,
        heal_amount: newHp - oldHp,
        next_character: nextTurnId,
        remaining_enemies: aliveEnemies.map(e => e.name),
      },
      newGameModeData: { ...gameModeData },
      newMode: 'combat',
      playerUpdates: [{ character_id: healTargetId, hp_current: newHp }],
      aoeUpdates: [],
      nextTurnId,
      defeatedEnemies: [],
    }
  }

  // ── Acción no ofensiva (huir, hablar, inspeccionar…) ─────────────────────
  if (mechanics.player_intent === 'other' || mechanics.is_action === false) {
    const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, false)
    return {
      combatResult: {
        attacker: activeCharacter.name,
        attacker_id: activeCharacter.id,
        skipped_turn: false,
        target: null, damage_dealt: 0,
        enemy_hp_before: null, enemy_hp_after: null, enemy_dead: false,
        all_enemies_dead: false,
        counterattack_damage: 0, counterattack_enemy: null,
        attacker_hp_before: currentPlayerHp, attacker_hp_after: currentPlayerHp,
        attacker_dead: false,
        aoe_targets: [],
        enemy_ability_triggered: null,
        next_character: nextTurnId,
        remaining_enemies: aliveEnemies.map(e => e.name),
      },
      newGameModeData: { ...gameModeData },
      newMode: 'combat',
      playerUpdates: [],
      aoeUpdates: [],
      nextTurnId,
      defeatedEnemies: [],
    }
  }

  // ── Ataque / habilidad ofensiva ───────────────────────────────────────────
  const targetEnemy = findTarget(mechanics.target_enemy_name, aliveEnemies)

  // Daño al enemigo
  let damageDealt = 0
  if (targetEnemy) {
    const atkEffective = mechanics.use_special_ability && activeCharacter.ability
      ? resolvePlayerAbilityAttack(activeCharacter, targetEnemy)
      : Math.max(0, activeCharacter.attack - targetEnemy.defense)
    damageDealt = atkEffective
  }

  const targetHpBefore = targetEnemy?.hp ?? null
  const targetHpAfter = targetEnemy ? Math.max(0, targetEnemy.hp - damageDealt) : null
  const enemyDead = targetEnemy ? (targetHpAfter <= 0) : false

  // Actualizar array de enemigos
  let updatedEnemies = enemies.map(e => {
    if (!targetEnemy || e.id !== targetEnemy.id) return e
    return { ...e, hp: targetHpAfter, defeated: enemyDead }
  })

  const aliveAfterAttack = updatedEnemies.filter(e => !e.defeated)
  const allEnemiesDead = aliveAfterAttack.length === 0

  // ── Contraataque (solo si el objetivo sobrevivió) ─────────────────────────
  let counterDamage = 0
  let aoeActive = false
  let stunActive = false
  let healAmount = 0
  let abilityTriggered = null
  let updatedTarget = targetEnemy ? updatedEnemies.find(e => e.id === targetEnemy.id) : null

  if (targetEnemy && !enemyDead) {
    const triggered = shouldTriggerAbility(updatedTarget, targetHpBefore)
    if (triggered && updatedTarget.ability) {
      abilityTriggered = updatedTarget.ability
      const fx = resolveAbilityEffect(updatedTarget.ability, updatedTarget, activeCharacter, [])
      counterDamage = fx.counterDamage
      healAmount = fx.healAmount
      aoeActive = fx.aoeActive
      stunActive = fx.stunActive

      // Marcar ability_used para triggers first_turn
      if (updatedTarget.ability.trigger === 'first_turn') {
        updatedEnemies = updatedEnemies.map(e =>
          e.id === updatedTarget.id ? { ...e, ability_used: true } : e
        )
      }
      // Aplicar curación al enemigo si es "heal"
      if (healAmount > 0) {
        updatedEnemies = updatedEnemies.map(e => {
          if (e.id !== updatedTarget.id) return e
          return { ...e, hp: Math.min(e.hp_max, e.hp + healAmount) }
        })
      }
    } else {
      counterDamage = baseCounterattack(updatedTarget, activeCharacter)
    }
  }

  // Daño al jugador activo (y AoE al resto)
  const newPlayerHp = Math.max(0, currentPlayerHp - counterDamage)
  const playerIsDead = newPlayerHp <= 0

  // AoE: calcular daño a los demás jugadores vivos
  const aoeUpdates = []
  if (aoeActive && !allEnemiesDead) {
    for (const id of presentIds) {
      if (id === activeCharacter.id) continue  // el activo ya recibe counterDamage
      const cs = characterStates.find(s => s.character_id === id)
      if (!cs || cs.is_dead) continue
      const char = { attack: activeCharacter.attack, defense: cs.defense ?? 0 }  // fallback
      const aoeDmg = Math.max(0, updatedTarget.attack - (cs.defense ?? 0))
      if (aoeDmg > 0) {
        aoeUpdates.push({ character_id: id, hp_delta: -aoeDmg, hp_current: Math.max(0, cs.hp_current - aoeDmg) })
      }
    }
  }

  // Aturdimiento: añadir a stunned list
  let newStunned = stunned.filter(id => id !== activeCharacter.id)
  if (stunActive && !playerIsDead) newStunned = [...newStunned, activeCharacter.id]

  // ── Siguiente turno ───────────────────────────────────────────────────────
  const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, playerIsDead)

  // ── Nuevo estado del modo de juego ────────────────────────────────────────
  const newMode = allEnemiesDead ? 'normal' : 'combat'
  const newGameModeData = allEnemiesDead
    ? null
    : { ...gameModeData, enemies: updatedEnemies, stunned: newStunned }

  // Enemigos derrotados en este turno (para loot)
  const defeatedEnemies = allEnemiesDead
    ? updatedEnemies.filter(e => e.defeated)
    : (enemyDead ? [updatedEnemies.find(e => e.id === targetEnemy.id)] : [])

  // ── combatResult para el narrador ─────────────────────────────────────────
  const combatResult = {
    attacker: activeCharacter.name,
    attacker_id: activeCharacter.id,
    skipped_turn: false,
    special_ability_used: mechanics.use_special_ability || false,
    target: targetEnemy?.name || null,
    damage_dealt: damageDealt,
    enemy_hp_before: targetHpBefore,
    enemy_hp_after: targetHpAfter,
    enemy_dead: enemyDead,
    all_enemies_dead: allEnemiesDead,
    counterattack_damage: counterDamage,
    counterattack_enemy: (targetEnemy && !enemyDead) ? targetEnemy.name : null,
    enemy_ability_triggered: abilityTriggered
      ? { name: abilityTriggered.name, effect: abilityTriggered.effect }
      : null,
    enemy_healed: healAmount > 0 ? healAmount : null,
    attacker_hp_before: currentPlayerHp,
    attacker_hp_after: newPlayerHp,
    attacker_dead: playerIsDead,
    attacker_stunned: stunActive,
    aoe_targets: aoeUpdates.map(u => ({ character_id: u.character_id, damage: Math.abs(u.hp_delta) })),
    next_character: nextTurnId,
    remaining_enemies: aliveAfterAttack.map(e => e.name),
  }

  return {
    combatResult,
    newGameModeData,
    newMode,
    // Escrituras pendientes para Supabase
    playerUpdates: counterDamage > 0 || playerIsDead
      ? [{ character_id: activeCharacter.id, hp_current: newPlayerHp, is_dead: playerIsDead }]
      : [],
    aoeUpdates,
    nextTurnId,
    defeatedEnemies,
  }
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

// Daño del jugador cuando usa habilidad especial (en vez de ataque normal).
// Basado en keywords de la descripción de la habilidad.
function resolvePlayerAbilityAttack(character, enemy) {
  const desc = (character.ability?.description || '').toLowerCase()

  // "dobla" / "doble" → ataque × 2
  if (desc.includes('dobla') || desc.includes('doble')) {
    return Math.max(0, character.attack * 2 - enemy.defense)
  }
  // "ignora 1 de defensa" → restar 1 a la defensa del enemigo
  if (desc.includes('ignora') && desc.includes('defensa')) {
    return Math.max(0, character.attack - Math.max(0, enemy.defense - 1))
  }
  // Por defecto: ataque normal
  return Math.max(0, character.attack - enemy.defense)
}

// Calcula el siguiente personaje en el orden de combate.
// Filtra muertos y respeta combat_turn_order.
function computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeId, activeJustDied) {
  const aliveIds = presentIds.filter(id => {
    if (id === activeId) return !activeJustDied
    return !characterStates.find(cs => cs.character_id === id)?.is_dead
  })

  const order = (gameModeData?.combat_turn_order || presentIds).filter(id => aliveIds.includes(id))
  if (!order.length) return aliveIds[0] || null

  const currentIdx = order.indexOf(currentTurnId)
  return order[(currentIdx + 1) % order.length]
}
