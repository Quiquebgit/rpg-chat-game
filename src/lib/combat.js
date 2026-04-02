// Función pura: calcula el resultado de un turno de combate.
// No lee ni escribe nada en Supabase — eso lo hace useMessages.js.
// Recibe el estado actual y devuelve el resultado + las escrituras pendientes.

import { XP_CONFIG, MONEY_CONFIG } from '../data/constants.js'

// Calcula el grado de éxito de una tirada respecto a un DC.
// ±4 puntos de margen definen éxito/fallo crítico.
export function checkDegree(total, dc) {
  if (total >= dc + 4) return 'critical_success'
  if (total >= dc) return 'success'
  if (total <= dc - 4) return 'critical_failure'
  return 'failure'
}

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
// hpBefore: HP del enemigo antes de recibir el daño del jugador.
function shouldTriggerAbility(enemy, hpBefore) {
  const ability = enemy.ability
  if (!ability) return false

  switch (ability.trigger) {
    case 'hp_below_half':
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

// Daño base del enemigo al jugador activo (sin modificadores de fruta).
function baseCounterattack(enemy, effectiveDef) {
  return Math.max(0, enemy.attack - effectiveDef)
}

// Aplica el efecto de la habilidad sobre el contraataque y devuelve los efectos adicionales.
function resolveAbilityEffect(ability, enemy, effectiveDef) {
  const baseDmg = baseCounterattack(enemy, effectiveDef)

  switch (ability.effect) {
    case 'double_attack':
      return { counterDamage: baseDmg * 2, healAmount: 0, aoeActive: false, stunActive: false }

    case 'aoe_attack':
      return { counterDamage: baseDmg, healAmount: 0, aoeActive: true, stunActive: false }

    case 'heal': {
      const healAmount = Math.max(1, Math.ceil(enemy.hp_max * 0.20))
      return { counterDamage: baseDmg, healAmount, aoeActive: false, stunActive: false }
    }

    case 'stun':
      return { counterDamage: baseDmg, healAmount: 0, aoeActive: false, stunActive: true }

    case 'poison':
      return { counterDamage: baseDmg + 1, healAmount: 0, aoeActive: false, stunActive: false }

    default:
      return { counterDamage: baseDmg, healAmount: 0, aoeActive: false, stunActive: false }
  }
}

// ─────────────────────────────────────────────────────────
// HELPERS DE EQUIPO Y FRUTAS
// ─────────────────────────────────────────────────────────

// Suma los bonos de equipamiento para una stat concreta.
// Incluye frutas equipadas si tienen effects[] con modificadores de stat.
function equipmentBonus(characterId, stat, characterStates) {
  const state = characterStates.find(s => s.character_id === characterId)
  const inventory = state?.inventory || []
  return inventory
    .filter(item => item.equipped || item.is_fruit)
    .flatMap(item => item.effects || [])
    .filter(ef => ef.stat === stat)
    .reduce((sum, ef) => sum + (ef.modifier || ef.value || 0), 0)
}

// Stats efectivos: base + equipo + boosts del gameModeData + upgrades permanentes por XP.
function effectiveStats(character, characterStates, gameModeData) {
  const boosts = gameModeData?.boosts?.[character.id] || {}
  const state = characterStates.find(s => s.character_id === character.id)
  const upgrades = state?.stat_upgrades || {}
  return {
    attack:     character.attack     + equipmentBonus(character.id, 'attack', characterStates)     + (boosts.attack     || 0) + (upgrades.attack     || 0),
    defense:    character.defense    + equipmentBonus(character.id, 'defense', characterStates)    + (boosts.defense    || 0) + (upgrades.defense    || 0),
    navigation: character.navigation + equipmentBonus(character.id, 'navigation', characterStates) + (boosts.navigation || 0) + (upgrades.navigation || 0),
    dexterity:  (character.dexterity  || 0) + equipmentBonus(character.id, 'dexterity', characterStates)  + (boosts.dexterity  || 0) + (upgrades.dexterity  || 0),
    charisma:   (character.charisma   || 0) + equipmentBonus(character.id, 'charisma', characterStates)   + (boosts.charisma   || 0) + (upgrades.charisma   || 0),
  }
}

// Frutas del diablo activas (comidas) del personaje.
function getEquippedFruits(characterId, characterStates) {
  const state = characterStates.find(s => s.character_id === characterId)
  const inventory = state?.inventory || []
  return inventory.filter(item => item.is_fruit || (item.type === 'fruta' && item.equipped))
}

// Comprueba si el personaje es inmune a los tipos de ataque dados.
// El haki siempre perfora inmunidades.
function isImmune(characterId, attackTypes, characterStates) {
  if (!attackTypes?.length) return false
  if (attackTypes.includes('haki')) return false

  const fruits = getEquippedFruits(characterId, characterStates)
  const allImmune = fruits.flatMap(f => f.immune_to || [])
  return attackTypes.every(t => allImmune.includes(t))
}

// Devuelve todos los special_effect de frutas activas del personaje.
function getFruitSpecials(characterId, characterStates) {
  return getEquippedFruits(characterId, characterStates)
    .map(f => f.special_effect)
    .filter(Boolean)
}

// Comprueba si un special de un tipo concreto ya fue usado en este combate.
function isSpecialUsed(characterId, effectType, gameModeData) {
  return (gameModeData?.fruit_specials_used?.[characterId] || []).includes(effectType)
}

// Devuelve nuevo gameModeData marcando el special como usado.
function withSpecialUsed(characterId, effectType, gameModeData) {
  const prev = gameModeData?.fruit_specials_used?.[characterId] || []
  return {
    ...gameModeData,
    fruit_specials_used: {
      ...(gameModeData?.fruit_specials_used || {}),
      [characterId]: [...prev, effectType],
    },
  }
}

// Aplica el debuff pasivo enemy_attack_debuff de frutas al ataque del enemigo.
function applyPassiveFruitDebuffs(enemyAttack, characterId, characterStates) {
  const specials = getFruitSpecials(characterId, characterStates)
  const debuff = specials
    .filter(s => s.type === 'enemy_attack_debuff')
    .reduce((sum, s) => sum + (s.value || 0), 0)
  return Math.max(0, enemyAttack - debuff)
}

// HP máximo de un aliado dado el array completo de personajes.
function allyMaxHp(targetId, allCharacters) {
  const char = allCharacters.find(c => c.id === targetId)
  return char?.hp ?? 5
}

// ─────────────────────────────────────────────────────────
// DAÑO DEL JUGADOR (ataque + habilidades de personaje)
// ─────────────────────────────────────────────────────────

// Resuelve el daño del jugador al enemigo, teniendo en cuenta habilidades activas.
// Devuelve { damage, doubleTriggered, ignoreDefenseUsed, abilityType }.
function resolvePlayerDamage(character, characterState, enemy, useSpecialAbility) {
  const ability = character.ability
  const effAtk = character._effectiveAttack ?? character.attack
  const baseAtk = Math.max(0, effAtk - enemy.defense)

  if (!useSpecialAbility || !ability) {
    // Auto-trigger: ranged_attack siempre ignora defensa (estilo de combate pasivo de Shin)
    if (ability?.type === 'ranged_attack') {
      const ignoreAmt = ability.effect?.ignore_defense ?? 1
      const reducedDef = Math.max(0, enemy.defense - ignoreAmt)
      return { damage: Math.max(0, effAtk - reducedDef), doubleTriggered: false, ignoreDefenseUsed: true, abilityType: 'ranged_attack' }
    }
    // Auto-trigger: double_attack_first en el primer turno (Crann)
    if (ability?.type === 'double_attack_first') {
      const alreadyDone = characterState?.first_attack_done ?? false
      if (!alreadyDone) {
        const dmg = Math.max(0, effAtk * (ability.effect?.multiplier ?? 2) - enemy.defense)
        return { damage: dmg, doubleTriggered: true, ignoreDefenseUsed: false, abilityType: 'double_attack_first' }
      }
    }
    return { damage: baseAtk, doubleTriggered: false, ignoreDefenseUsed: false, abilityType: null }
  }

  switch (ability.type) {
    case 'double_attack_first': {
      const alreadyDone = characterState?.first_attack_done ?? false
      if (!alreadyDone) {
        const dmg = Math.max(0, effAtk * (ability.effect?.multiplier ?? 2) - enemy.defense)
        return { damage: dmg, doubleTriggered: true, ignoreDefenseUsed: false, abilityType: 'double_attack_first' }
      }
      return { damage: baseAtk, doubleTriggered: false, ignoreDefenseUsed: false, abilityType: 'double_attack_first' }
    }

    case 'ranged_attack': {
      const ignoreAmt = ability.effect?.ignore_defense ?? 1
      const reducedDef = Math.max(0, enemy.defense - ignoreAmt)
      const dmg = Math.max(0, effAtk - reducedDef)
      return { damage: dmg, doubleTriggered: false, ignoreDefenseUsed: true, abilityType: 'ranged_attack' }
    }

    default:
      return { damage: baseAtk, doubleTriggered: false, ignoreDefenseUsed: false, abilityType: ability.type }
  }
}

// ─────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────

export function resolveCombatTurn({
  mechanics,        // { player_intent, target_enemy_name, target_ally_id, use_special_ability, is_action }
  activeCharacter,  // { id, name, attack, defense, hp, ability, navigation }
  gameModeData,     // { enemies, combat_turn_order, boosts, fruit_specials_used, ... }
  characterStates,  // [{ character_id, hp_current, is_dead, stunned, inventory, first_attack_done, combat_ability_used }]
  presentIds,       // ['shin', 'darro']
  currentTurnId,    // session.current_turn_character_id
  allCharacters = [], // array completo de personajes (para hp_max en heal)
}) {
  const enemies = gameModeData?.enemies || []
  const aliveEnemies = enemies.filter(e => !e.defeated)

  const currentState = characterStates.find(s => s.character_id === activeCharacter.id)
  const currentPlayerHp = currentState?.hp_current ?? activeCharacter.hp

  // Stats efectivos del jugador activo (equipo + boosts)
  const effStats = effectiveStats(activeCharacter, characterStates, gameModeData)
  // Inyectar en activeCharacter para helpers internos
  activeCharacter = { ...activeCharacter, _effectiveAttack: effStats.attack, _effectiveDefense: effStats.defense }

  // ── Comprobar si el jugador activo está aturdido ──────────────────────────
  const isStunned = currentState?.stunned ?? false
  if (isStunned) {
    const totalCounterDmg = aliveEnemies.reduce(
      (sum, e) => sum + Math.max(0, e.attack - effStats.defense), 0
    )
    const newPlayerHp = Math.max(0, currentPlayerHp - totalCounterDmg)
    const playerIsDead = newPlayerHp <= 0
    const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, playerIsDead)

    return {
      combatResult: {
        attacker: activeCharacter.name,
        attacker_id: activeCharacter.id,
        skipped_turn: true,
        stunned_exposed: true,
        target: null, damage_dealt: 0,
        enemy_hp_before: null, enemy_hp_after: null, enemy_dead: false,
        all_enemies_dead: false,
        counterattack_damage: totalCounterDmg,
        counterattack_enemy: aliveEnemies.map(e => e.name).join(', ') || null,
        attacker_hp_before: currentPlayerHp,
        attacker_hp_after: newPlayerHp,
        attacker_dead: playerIsDead,
        attacker_stunned: false,
        aoe_targets: [],
        enemy_ability_triggered: null,
        next_character: nextTurnId,
        remaining_enemies: aliveEnemies.map(e => e.name),
      },
      newGameModeData: { ...gameModeData },
      newMode: 'combat',
      playerUpdates: [{ character_id: activeCharacter.id, hp_current: newPlayerHp, is_dead: playerIsDead, stunned: false }],
      aoeUpdates: [],
      applyStunTo: null,
      nextTurnId,
      defeatedEnemies: [],
    }
  }

  // ── Boost de estadística — Liderazgo de Darro ────────────────────────────
  if (mechanics.player_intent === 'stat_boost') {
    const targetId = mechanics.target_ally_id || activeCharacter.id
    const ability = activeCharacter.ability
    const alreadyUsed = currentState?.combat_ability_used ?? false

    let newGameModeData = { ...gameModeData }
    let boostApplied = null

    if (!alreadyUsed && ability?.type === 'stat_boost') {
      const stat   = mechanics.selected_stat || ability.effect?.stat || 'attack'
      const value  = ability.effect?.value ?? 2
      const prevBoosts = gameModeData?.boosts?.[targetId] || {}
      boostApplied = { target: targetId, stat, value }
      newGameModeData = {
        ...gameModeData,
        boosts: {
          ...(gameModeData?.boosts || {}),
          [targetId]: { ...prevBoosts, [stat]: (prevBoosts[stat] || 0) + value },
        },
      }
    }

    const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, false)

    return {
      combatResult: {
        attacker: activeCharacter.name, attacker_id: activeCharacter.id,
        skipped_turn: false, stunned_exposed: false,
        target: null, damage_dealt: 0,
        enemy_hp_before: null, enemy_hp_after: null, enemy_dead: false,
        all_enemies_dead: false,
        counterattack_damage: 0, counterattack_enemy: null,
        attacker_hp_before: currentPlayerHp, attacker_hp_after: currentPlayerHp,
        attacker_dead: false, attacker_stunned: false,
        aoe_targets: [], enemy_ability_triggered: null,
        stat_boost_applied: boostApplied,
        next_character: nextTurnId,
        remaining_enemies: aliveEnemies.map(e => e.name),
      },
      newGameModeData,
      newMode: 'combat',
      playerUpdates: boostApplied ? [{ character_id: activeCharacter.id, combat_ability_used: true }] : [],
      aoeUpdates: [], applyStunTo: null, nextTurnId, defeatedEnemies: [],
    }
  }

  // ── Curación — Vela ───────────────────────────────────────────────────────
  if (mechanics.player_intent === 'heal') {
    const healTargetId = mechanics.target_ally_id || activeCharacter.id
    const healTarget = characterStates.find(s => s.character_id === healTargetId)
    const ability = activeCharacter.ability
    const healValue = ability?.effect?.value_combat ?? 2
    const maxHp = allyMaxHp(healTargetId, allCharacters)
    const oldHp = healTarget?.hp_current ?? maxHp
    const newHp = Math.min(maxHp, oldHp + healValue)
    const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, false)

    return {
      combatResult: {
        attacker: activeCharacter.name, attacker_id: activeCharacter.id,
        skipped_turn: false, stunned_exposed: false,
        target: null, damage_dealt: 0,
        enemy_hp_before: null, enemy_hp_after: null, enemy_dead: false,
        all_enemies_dead: false,
        counterattack_damage: 0, counterattack_enemy: null,
        attacker_hp_before: currentPlayerHp, attacker_hp_after: currentPlayerHp,
        attacker_dead: false, attacker_stunned: false,
        aoe_targets: [], enemy_ability_triggered: null,
        heal_target: healTargetId, heal_amount: newHp - oldHp,
        next_character: nextTurnId,
        remaining_enemies: aliveEnemies.map(e => e.name),
      },
      newGameModeData: { ...gameModeData },
      newMode: 'combat',
      playerUpdates: [{ character_id: healTargetId, hp_current: newHp }],
      aoeUpdates: [], applyStunTo: null, nextTurnId, defeatedEnemies: [],
    }
  }

  // ── Acción no ofensiva (huir, hablar…) ───────────────────────────────────
  if (mechanics.player_intent === 'other' || mechanics.is_action === false) {
    const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, false)
    return {
      combatResult: {
        attacker: activeCharacter.name, attacker_id: activeCharacter.id,
        skipped_turn: false, stunned_exposed: false,
        target: null, damage_dealt: 0,
        enemy_hp_before: null, enemy_hp_after: null, enemy_dead: false,
        all_enemies_dead: false,
        counterattack_damage: 0, counterattack_enemy: null,
        attacker_hp_before: currentPlayerHp, attacker_hp_after: currentPlayerHp,
        attacker_dead: false, attacker_stunned: false,
        aoe_targets: [], enemy_ability_triggered: null,
        next_character: nextTurnId,
        remaining_enemies: aliveEnemies.map(e => e.name),
      },
      newGameModeData: { ...gameModeData },
      newMode: 'combat',
      playerUpdates: [], aoeUpdates: [], applyStunTo: null, nextTurnId, defeatedEnemies: [],
    }
  }

  // ── Ataque, esquiva o habilidad ofensiva ──────────────────────────────────
  const targetEnemy = findTarget(mechanics.target_enemy_name, aliveEnemies)
  const isDodge = mechanics.player_intent === 'dodge'

  // ── Fruta especial AoE (una sola vez por combate) ─────────────────────────
  const fruitsSpecials = getFruitSpecials(activeCharacter.id, characterStates)
  const aoeSpecial = fruitsSpecials.find(s => s.type === 'aoe_attack')
  const canUseAoe = aoeSpecial && !isSpecialUsed(activeCharacter.id, 'aoe_attack', gameModeData)
  const useFruitAoe = mechanics.use_special_ability && canUseAoe && !isDodge

  let updatedEnemies = [...enemies]
  let aoeEnemyResults = []
  let gmd = { ...gameModeData }

  if (useFruitAoe) {
    const aoeDmgValue = aoeSpecial.value ?? effStats.attack
    aoeEnemyResults = aliveEnemies.map(e => {
      const dmg = Math.max(0, aoeDmgValue - e.defense)
      const newHp = Math.max(0, e.hp - dmg)
      return { id: e.id, name: e.name, damage: dmg, hp_after: newHp, defeated: newHp <= 0 }
    })
    updatedEnemies = updatedEnemies.map(e => {
      const res = aoeEnemyResults.find(r => r.id === e.id)
      return res ? { ...e, hp: res.hp_after, defeated: res.defeated } : e
    })
    gmd = withSpecialUsed(activeCharacter.id, 'aoe_attack', gmd)
  }

  // ── Daño al enemigo objetivo ───────────────────────────────────────────────
  let damageDealt = 0
  let doubleTriggered = false
  let ignoreDefenseUsed = false
  let abilityType = null
  let blindApplied = false

  const targetHpBefore = targetEnemy?.hp ?? null

  if (targetEnemy && !isDodge && !useFruitAoe) {
    const dmgResult = resolvePlayerDamage(
      activeCharacter, currentState, targetEnemy,
      mechanics.use_special_ability
    )
    damageDealt     = dmgResult.damage
    doubleTriggered = dmgResult.doubleTriggered
    ignoreDefenseUsed = dmgResult.ignoreDefenseUsed
    abilityType     = dmgResult.abilityType

    // Fruta: cegar al enemigo (blind, una sola vez)
    const blindSpecial = fruitsSpecials.find(s => s.type === 'blind')
    if (blindSpecial && !isSpecialUsed(activeCharacter.id, 'blind', gmd) && mechanics.use_special_ability) {
      blindApplied = true
      gmd = withSpecialUsed(activeCharacter.id, 'blind', gmd)
    }
  }

  const targetHpAfter = targetEnemy
    ? (useFruitAoe
        ? aoeEnemyResults.find(r => r.id === targetEnemy.id)?.hp_after ?? targetEnemy.hp
        : Math.max(0, targetEnemy.hp - damageDealt))
    : null

  const enemyDead = targetEnemy && !isDodge
    ? (targetHpAfter <= 0)
    : false

  // Actualizar HP del enemigo objetivo (si no fue AoE)
  if (!useFruitAoe && targetEnemy) {
    updatedEnemies = updatedEnemies.map(e =>
      e.id === targetEnemy.id ? { ...e, hp: targetHpAfter, defeated: enemyDead } : e
    )
  }

  const aliveAfterAttack = updatedEnemies.filter(e => !e.defeated)
  const allEnemiesDead = aliveAfterAttack.length === 0

  // ── Contraataque ──────────────────────────────────────────────────────────
  const enemyCanCounter = targetEnemy && (isDodge || !enemyDead) && !allEnemiesDead

  let counterDamage = 0
  let aoeActive = false
  let stunActive = false
  let healAmount = 0
  let abilityTriggered = null
  let immunityTriggered = false
  let blockTriggered = false
  let reflectTriggered = false
  let reflectDamageToEnemy = 0
  let updatedTarget = targetEnemy ? updatedEnemies.find(e => e.id === targetEnemy.id) : null

  if (enemyCanCounter && updatedTarget) {
    const enemyAttackTypes = updatedTarget.attack_type || ['physical']

    // 1. Inmunidad por fruta
    if (isImmune(activeCharacter.id, enemyAttackTypes, characterStates)) {
      immunityTriggered = true
      counterDamage = 0
    } else {
      // 2. Bloqueo por fruta (primera vez, contra physical/ranged)
      const blockSpecial = fruitsSpecials.find(s => s.type === 'block')
      const canBlock = blockSpecial && !isSpecialUsed(activeCharacter.id, 'block', gmd)
      const isBlockable = enemyAttackTypes.some(t => ['physical', 'ranged'].includes(t))

      if (canBlock && isBlockable) {
        blockTriggered = true
        counterDamage = 0
        gmd = withSpecialUsed(activeCharacter.id, 'block', gmd)
      } else {
        // 3. Reflejo por fruta (50% contra ranged/explosion, una sola vez)
        const reflectSpecial = fruitsSpecials.find(s => s.type === 'reflect')
        const canReflect = reflectSpecial && !isSpecialUsed(activeCharacter.id, 'reflect', gmd)
        const isReflectable = enemyAttackTypes.some(t => ['ranged', 'explosion'].includes(t))

        if (canReflect && isReflectable && Math.random() < 0.5) {
          reflectTriggered = true
          const rawDmg = baseCounterattack(updatedTarget, effStats.defense)
          reflectDamageToEnemy = Math.ceil(rawDmg * (reflectSpecial.value ?? 0.5))
          counterDamage = 0
          gmd = withSpecialUsed(activeCharacter.id, 'reflect', gmd)
          // Aplicar daño de reflejo al enemigo
          updatedEnemies = updatedEnemies.map(e => {
            if (e.id !== updatedTarget.id) return e
            const newHp = Math.max(0, e.hp - reflectDamageToEnemy)
            return { ...e, hp: newHp, defeated: newHp <= 0 }
          })
        } else {
          // 4. Habilidad del enemigo o ataque normal
          const triggered = shouldTriggerAbility(updatedTarget, targetHpBefore)
          if (triggered && updatedTarget.ability) {
            abilityTriggered = updatedTarget.ability

            // Aplicar debuffs pasivos de fruta al ataque del enemigo
            const debuffedAttack = applyPassiveFruitDebuffs(updatedTarget.attack, activeCharacter.id, characterStates)
            const tempEnemy = { ...updatedTarget, attack: debuffedAttack }

            // Penalización blind: -1 ataque del enemigo si está cegado
            const blindedEnemy = blindApplied ? { ...tempEnemy, attack: Math.max(0, tempEnemy.attack - 1) } : tempEnemy

            const fx = resolveAbilityEffect(updatedTarget.ability, blindedEnemy, effStats.defense)
            counterDamage = fx.counterDamage
            healAmount    = fx.healAmount
            aoeActive     = fx.aoeActive
            stunActive    = fx.stunActive

            if (updatedTarget.ability.trigger === 'first_turn') {
              updatedEnemies = updatedEnemies.map(e =>
                e.id === updatedTarget.id ? { ...e, ability_used: true } : e
              )
            }
            if (healAmount > 0) {
              updatedEnemies = updatedEnemies.map(e => {
                if (e.id !== updatedTarget.id) return e
                return { ...e, hp: Math.min(e.hp_max, e.hp + healAmount) }
              })
            }
          } else {
            // Ataque normal con debuffs de fruta + blind
            let effEnemyAtk = applyPassiveFruitDebuffs(updatedTarget.attack, activeCharacter.id, characterStates)
            if (blindApplied) effEnemyAtk = Math.max(0, effEnemyAtk - 1)
            counterDamage = Math.max(0, effEnemyAtk - effStats.defense)
          }
        }
      }
    }
  }

  // Daño al jugador activo
  const newPlayerHp = Math.max(0, currentPlayerHp - counterDamage)
  const playerIsDead = newPlayerHp <= 0

  // AoE enemigo: daño a todos los jugadores vivos (usa defense efectiva con equipo)
  const aoeUpdates = []
  if (aoeActive && !allEnemiesDead && updatedTarget) {
    for (const id of presentIds) {
      if (id === activeCharacter.id) continue
      const cs = characterStates.find(s => s.character_id === id)
      if (!cs || cs.is_dead) continue
      const allyChar = allCharacters.find(c => c.id === id)
      const allyBaseDef = allyChar?.defense ?? 0
      const allyEffDef = allyBaseDef + equipmentBonus(id, 'defense', characterStates)
      const aoeDmg = Math.max(0, updatedTarget.attack - allyEffDef)
      if (aoeDmg > 0) {
        aoeUpdates.push({
          character_id: id,
          hp_current: Math.max(0, cs.hp_current - aoeDmg),
          is_dead: cs.hp_current - aoeDmg <= 0,
        })
      }
    }
  }

  // ── Siguiente turno ───────────────────────────────────────────────────────
  const finalAliveAfterAll = updatedEnemies.filter(e => !e.defeated)
  const allEnemiesDeadFinal = finalAliveAfterAll.length === 0

  const nextTurnId = computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeCharacter.id, playerIsDead)

  const newMode = allEnemiesDeadFinal ? 'normal' : 'combat'
  gmd = allEnemiesDeadFinal ? null : { ...gmd, enemies: updatedEnemies }

  const defeatedEnemies = allEnemiesDeadFinal
    ? updatedEnemies.filter(e => e.defeated)
    : (enemyDead ? [updatedEnemies.find(e => e.id === targetEnemy.id)] : [])

  // ── combatResult para el narrador ─────────────────────────────────────────
  const combatResult = {
    attacker: activeCharacter.name,
    attacker_id: activeCharacter.id,
    skipped_turn: false,
    stunned_exposed: false,
    dodge: isDodge,
    special_ability_used: !isDodge && (mechanics.use_special_ability || false),
    ability_type: abilityType,
    target: targetEnemy?.name || null,
    damage_dealt: useFruitAoe ? aoeEnemyResults.reduce((s, r) => s + r.damage, 0) : damageDealt,
    enemy_hp_before: targetHpBefore,
    enemy_hp_after: targetHpAfter,
    enemy_dead: enemyDead,
    all_enemies_dead: allEnemiesDeadFinal,
    counterattack_damage: counterDamage,
    counterattack_enemy: (enemyCanCounter && !immunityTriggered && !blockTriggered && !reflectTriggered)
      ? updatedTarget?.name || null
      : null,
    enemy_ability_triggered: abilityTriggered
      ? { name: abilityTriggered.name, effect: abilityTriggered.effect }
      : null,
    enemy_healed: healAmount > 0 ? healAmount : null,
    attacker_hp_before: currentPlayerHp,
    attacker_hp_after: newPlayerHp,
    attacker_dead: playerIsDead,
    attacker_stunned: stunActive && !playerIsDead,
    aoe_targets: aoeUpdates.map(u => ({ character_id: u.character_id, damage: (u.hp_current - (characterStates.find(s => s.character_id === u.character_id)?.hp_current ?? 0)) * -1 })),
    // Mecánicas de fruta
    fruit_immunity_triggered: immunityTriggered,
    block_triggered: blockTriggered,
    reflect_triggered: reflectTriggered,
    reflect_damage_to_enemy: reflectDamageToEnemy || null,
    blind_applied: blindApplied,
    aoe_triggered: useFruitAoe,
    aoe_enemy_results: useFruitAoe ? aoeEnemyResults : null,
    double_attack_triggered: doubleTriggered,
    next_character: nextTurnId,
    remaining_enemies: finalAliveAfterAll.map(e => e.name),
  }

  // playerUpdates: daño + tracking de primera acción y habilidad de combate
  const playerUpdateNeeded = counterDamage > 0 || playerIsDead || stunActive || doubleTriggered
  const playerUpdate = {
    character_id: activeCharacter.id,
    ...(playerUpdateNeeded ? { hp_current: newPlayerHp, is_dead: playerIsDead, stunned: stunActive && !playerIsDead } : {}),
    // Marcar primer ataque (Crann)
    ...(doubleTriggered ? { first_attack_done: true } : {}),
    // Marcar habilidad de combate usada si se usó con use_special_ability
    ...(mechanics.use_special_ability && abilityType ? { combat_ability_used: true } : {}),
  }
  const hasPlayerUpdate = Object.keys(playerUpdate).length > 1

  return {
    combatResult,
    newGameModeData: gmd,
    newMode,
    playerUpdates: hasPlayerUpdate ? [playerUpdate] : [],
    aoeUpdates,
    applyStunTo: (stunActive && !playerIsDead) ? activeCharacter.id : null,
    nextTurnId,
    defeatedEnemies,
  }
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// RECOMPENSAS — XP y DINERO
// ─────────────────────────────────────────────────────────

// Clasifica un enemigo por rareza en función de su HP máximo.
function enemyTier(enemy) {
  const hp = enemy.hp_max ?? enemy.hp ?? 0
  if (hp >= 8) return 'ENEMY_UNIQUE'
  if (hp >= 5) return 'ENEMY_RARE'
  return 'ENEMY_COMMON'
}

// XP total por todos los enemigos derrotados en el combate.
export function calculateXpReward(defeatedEnemies = []) {
  return defeatedEnemies.reduce((sum, e) => sum + XP_CONFIG[enemyTier(e)], 0)
}

// Berries totales (para repartir entre jugadores) por enemigos derrotados.
export function calculateMoneyReward(defeatedEnemies = []) {
  return defeatedEnemies.reduce((sum, e) => {
    const { min, max } = MONEY_CONFIG[enemyTier(e)]
    return sum + Math.floor(Math.random() * (max - min + 1)) + min
  }, 0)
}

// ─────────────────────────────────────────────────────────
// Calcula el siguiente personaje en el orden de combate.
// Filtra muertos y respeta combat_turn_order.
function computeNextTurn(presentIds, characterStates, gameModeData, currentTurnId, activeId, activeJustDied) {
  const aliveIds = presentIds.filter(id => {
    if (id === activeId) return !activeJustDied
    return !characterStates.find(cs => cs.character_id === id)?.is_dead
  })

  // Solo incluir en rotación a quienes tiraron iniciativa (si ya hay orden fijado)
  const initiative = gameModeData?.initiative
  const validIds = (initiative && Object.keys(initiative).length > 0)
    ? aliveIds.filter(id => initiative[id] !== undefined)
    : aliveIds

  const order = (gameModeData?.combat_turn_order || presentIds).filter(id => validIds.includes(id))
  if (!order.length) return validIds[0] || null

  const currentIdx = order.indexOf(currentTurnId)
  return order[(currentIdx + 1) % order.length]
}
